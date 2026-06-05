import { PROVIDERS } from './providers.js';

// Live model-catalog fetching with a small localStorage cache.
//
// Layered design (all client-side, no backend):
//   1. Per-provider GET /models (OpenAI, Anthropic, Groq) once the user has
//      entered an API key — gives a real-time list straight from the provider.
//   2. OpenRouter's PUBLIC /models endpoint (no key) aggregates hundreds of
//      models across nearly every lab and refreshes itself.
//   3. The hardcoded `models` array on each provider is the offline fallback,
//      and "Custom / OpenAI-compatible" remains the universal escape hatch.
//
// Results are cached per provider for a day so we stay fresh without hammering
// the APIs (and so repeated key edits don't trigger a request storm).

const CACHE_PREFIX = 'n8n_gen_models_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 15000;

function readCache(provider) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + provider);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.models)) return null;
    return parsed; // { ts: number, models: string[] }
  } catch (e) {
    return null;
  }
}

function writeCache(provider, models) {
  try {
    localStorage.setItem(CACHE_PREFIX + provider, JSON.stringify({ ts: Date.now(), models }));
  } catch (e) {
    /* quota / disabled storage — caching is best-effort */
  }
}

/**
 * Fetch the live model list for a provider.
 *
 * @param {string} providerKey  key into PROVIDERS
 * @param {object} [opts]
 * @param {string} [opts.apiKey] user's API key (needed for keyed providers)
 * @param {boolean} [opts.force] bypass the cache and refetch
 * @param {number} [opts.timeout] request timeout in ms
 * @returns {Promise<string[]|null>} sorted model ids, or null when there is no
 *   live source available (e.g. provider has no catalog, or a key is required
 *   but missing). On network/HTTP failure, returns a stale cache if present,
 *   otherwise throws.
 */
export async function fetchModels(providerKey, { apiKey = '', force = false, timeout = FETCH_TIMEOUT_MS } = {}) {
  const cfg = PROVIDERS[providerKey];
  if (!cfg || !cfg.modelsUrl || typeof cfg.buildModelsRequest !== 'function') return null;
  if (cfg.requiresKeyForModels && !apiKey) return null;

  if (!force) {
    const cached = readCache(providerKey);
    if (cached && cached.models.length && (Date.now() - cached.ts) < TTL_MS) {
      return cached.models;
    }
  }

  const req = cfg.buildModelsRequest(apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(req.url, { method: 'GET', headers: req.headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    // Network error / CORS / abort — fall back to any cached list before failing.
    const cached = readCache(providerKey);
    if (cached && cached.models.length) return cached.models;
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const cached = readCache(providerKey);
    if (cached && cached.models.length) return cached.models;
    throw new Error('HTTP ' + res.status);
  }

  const data = await res.json();
  const models = cfg.parseModels(data);
  if (Array.isArray(models) && models.length) {
    writeCache(providerKey, models);
    return models;
  }
  // Empty/unexpected payload — prefer stale cache, else signal "no live data".
  const cached = readCache(providerKey);
  return (cached && cached.models.length) ? cached.models : null;
}
