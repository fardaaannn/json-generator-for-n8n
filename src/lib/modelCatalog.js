import { PROVIDERS } from './providers.js';
import { assertHttpUrl } from './pipeline.js';

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

function writeCache(key, models, meta) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), models, meta: meta || {} }));
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

  // Defense-in-depth: the request URL is derived from a user-supplied base URL
  // (for the Custom provider) and we attach the user's API key to it as a
  // Bearer token. Validate the scheme before fetching so the credential can
  // never be sent to a non-network scheme (javascript:, data:, file:, ...) if a
  // malformed/hostile base URL reaches here. Mirrors the same guard applied on
  // the generation path (see assertHttpUrl in pipeline.js). On an invalid URL,
  // prefer any cached list, else signal "no live data" instead of throwing.
  try {
    assertHttpUrl(req.url);
  } catch (e) {
    const cached = readCache(key);
    return (cached && cached.models.length) ? cached.models : null;
  }

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
  const meta = (typeof cfg.parseModelsMeta === 'function' ? cfg.parseModelsMeta(data) : {}) || {};
  if (models.length) {
    writeCache(key, models, meta);
    return models;
  }
  // Empty/unexpected payload — prefer stale cache, else signal "no live data".
  const cached = readCache(key);
  return (cached && cached.models.length) ? cached.models : null;
}


/**
 * Read the cached per-model metadata map for a provider (populated as a side
 * effect of fetchModels). Returns a `Record<id, { context?, pricePrompt?,
 * priceCompletion? }>`, or an empty object when there's nothing cached. This
 * is synchronous (localStorage) so the UI can render it right after the model
 * list resolves, without a second async round-trip.
 */
export function getModelMeta(providerKey, { apiKey = '', baseUrl = '' } = {}) {
  const cfg = PROVIDERS[providerKey];
  if (!cfg) return {};
  const cached = readCache(cacheKey(providerKey, cacheScope(cfg, apiKey, baseUrl)));
  return (cached && cached.meta && typeof cached.meta === 'object') ? cached.meta : {};
}

// Render a context window as a compact "128K" / "1M" style string.
function formatContext(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return (Number.isInteger(m) ? m : m.toFixed(1)) + 'M';
  }
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

// Convert a USD-per-token price into a short USD-per-1M-tokens string, e.g.
// 0.0000025 -> "$2.5". Trailing zeros are trimmed; sub-cent prices keep enough
// precision to stay meaningful.
function formatPrice(perToken) {
  const n = Number(perToken);
  if (!Number.isFinite(n)) return '';
  const per1M = n * 1_000_000;
  if (per1M === 0) return '$0';
  const decimals = per1M < 1 ? 3 : 2;
  return '$' + parseFloat(per1M.toFixed(decimals)).toString();
}

/**
 * Build a compact, human-readable summary of a model's metadata for the picker,
 * e.g. "128K · $2.5/$10" (context window · prompt/completion price per 1M
 * tokens) or "free" when both prices are zero. Returns '' when nothing useful
 * is known. Kept pure so it's easy to unit-test and reuse.
 */
export function formatModelMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const parts = [];
  const ctx = formatContext(meta.context);
  if (ctx) parts.push(ctx);

  const hasP = meta.pricePrompt != null;
  const hasC = meta.priceCompletion != null;
  if (hasP || hasC) {
    const p = Number(meta.pricePrompt) || 0;
    const c = Number(meta.priceCompletion) || 0;
    if (p === 0 && c === 0) {
      parts.push('free');
    } else {
      parts.push(formatPrice(p) + '/' + formatPrice(c));
    }
  }
  return parts.join(' \u00b7 ');
}
