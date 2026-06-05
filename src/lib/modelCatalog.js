import { PROVIDERS } from './providers.js';

// Live model-catalog fetching with a small localStorage cache.
//
// Layered design (all client-side, no backend):
//   1. Per-provider GET /models (OpenAI, Anthropic, Groq) once the user has
//      entered an API key — gives a real-time list straight from the provider.
//   2. OpenRouter's PUBLIC /models endpoint (no key) aggregates hundreds of
//      models across nearly every lab and refreshes itself.
//   3. Custom / OpenAI-compatible: GET <baseUrl>/models, so any self-hosted or
//      gateway endpoint can expose its own catalog.
//   4. The hardcoded `models` array on each provider is the offline fallback.
//
// Results are cached for a day so we stay fresh without hammering the APIs.
// The cache is namespaced per credential (API key for keyed providers, base
// URL + key for Custom) so switching keys/endpoints never serves a list that
// belongs to a different account — see `cacheKey`/`cacheScope` below.

const CACHE_PREFIX = 'n8n_gen_models_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 15000;

// Tiny non-cryptographic fingerprint (djb2). Used only to namespace the cache
// per credential so we never persist the raw API key / base URL inside a
// localStorage key — collisions just mean a (rare) cache miss, never a leak.
function fingerprint(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// What distinguishes one cached catalog from another for a given provider:
//   - Custom: the base URL (+ key, since some gateways gate models by key)
//   - keyed providers (OpenAI / Anthropic / Groq): the API key
//   - public catalogs (OpenRouter): nothing — a single shared cache
function cacheScope(cfg, apiKey, baseUrl) {
  if (cfg.requiresBaseUrlForModels) return (baseUrl || '') + '|' + (apiKey || '');
  if (cfg.requiresKeyForModels) return apiKey || '';
  return '';
}

function cacheKey(providerKey, scope) {
  return CACHE_PREFIX + providerKey + (scope ? '_' + fingerprint(scope) : '');
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.models)) return null;
    return parsed; // { ts: number, models: string[] }
  } catch (e) {
    return null;
  }
}

function writeCache(key, models) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), models }));
  } catch (e) {
    /* quota / disabled storage — caching is best-effort */
  }
}

// Remove duplicate ids and float the provider's "recommended" models to the
// top (in the order they're declared), keeping everything else in its original
// order. This both de-dupes the catalog and makes the curated picks easy to
// find at the head of an otherwise huge/alphabetical list.
function dedupeAndPrioritize(list, recommended = []) {
  const deduped = [];
  const seen = new Set();
  for (const m of list) {
    if (m && !seen.has(m)) { seen.add(m); deduped.push(m); }
  }
  if (!recommended.length) return deduped;
  const recSet = new Set(recommended);
  const top = [];
  const rest = [];
  for (const m of deduped) (recSet.has(m) ? top : rest).push(m);
  top.sort((a, b) => recommended.indexOf(a) - recommended.indexOf(b));
  return [...top, ...rest];
}

/**
 * Fetch the live model list for a provider.
 *
 * @param {string} providerKey  key into PROVIDERS
 * @param {object} [opts]
 * @param {string} [opts.apiKey] user's API key (needed for keyed providers)
 * @param {string} [opts.baseUrl] base URL (needed for the Custom provider)
 * @param {boolean} [opts.force] bypass the cache and refetch
 * @param {number} [opts.timeout] request timeout in ms
 * @returns {Promise<string[]|null>} de-duped, recommended-first model ids, or
 *   null when there is no live source available (e.g. provider has no catalog,
 *   or a key/base URL is required but missing). On network/HTTP failure,
 *   returns a stale cache if present, otherwise throws.
 */
export async function fetchModels(providerKey, { apiKey = '', baseUrl = '', force = false, timeout = FETCH_TIMEOUT_MS } = {}) {
  const cfg = PROVIDERS[providerKey];
  if (!cfg || typeof cfg.buildModelsRequest !== 'function') return null;
  if (cfg.requiresBaseUrlForModels && !baseUrl) return null;
  if (cfg.requiresKeyForModels && !apiKey) return null;

  const key = cacheKey(providerKey, cacheScope(cfg, apiKey, baseUrl));

  if (!force) {
    const cached = readCache(key);
    if (cached && cached.models.length && (Date.now() - cached.ts) < TTL_MS) {
      return cached.models;
    }
  }

  const req = cfg.buildModelsRequest(apiKey, baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(req.url, { method: 'GET', headers: req.headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    // Network error / CORS / abort — fall back to any cached list before failing.
    const cached = readCache(key);
    if (cached && cached.models.length) return cached.models;
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const cached = readCache(key);
    if (cached && cached.models.length) return cached.models;
    throw new Error('HTTP ' + res.status);
  }

  const data = await res.json();
  const models = dedupeAndPrioritize(cfg.parseModels(data) || [], cfg.recommended);
  if (models.length) {
    writeCache(key, models);
    return models;
  }
  // Empty/unexpected payload — prefer stale cache, else signal "no live data".
  const cached = readCache(key);
  return (cached && cached.models.length) ? cached.models : null;
}
