// Share-via-URL: encode a workflow JSON string into a compact, URL-safe token
// carried in the location hash (#w=...), and decode it back. Everything runs
// client-side — the hash fragment is never sent to the server (privacy: the
// same reason API keys never leave the browser), and no backend is involved.
//
// Compression uses the native gzip CompressionStream when available (zero
// dependency), falling back to plain base64url when it isn't, so the feature
// degrades gracefully on older browsers instead of failing. decode() auto-
// detects which path produced a token, so links stay readable across browsers.

const HASH_PREFIX = 'w='; // location.hash looks like "#w=<token>"
// Tokens are tagged with a 1-char codec marker so decode knows how to reverse
// them: 'g' = gzip+base64url, 'r' = raw base64url (no compression fallback).
const CODEC_GZIP = 'g';
const CODEC_RAW = 'r';

// --- token format versioning -----------------------------------------------
// Legacy tokens (no version): "<codec><base64url(workflow json)>".
// v1+ tokens: "<version digit(s)><codec><base64url(envelope json)>", where the
// envelope is { v, ts, w } and `w` is the original workflow JSON string. The
// envelope gives future format changes a place to live; the contract is that
// any future version keeps `w`, so older apps can still extract the workflow
// from newer links (forward compatibility), and decode() reports an
// unsupported version distinctly so the UI can explain instead of failing
// silently. Codec chars are non-digits, so the two formats never collide.
const FORMAT_VERSION = 1;

// --- base64url helpers (no '+', '/', '=' so the token is URL/hash safe) ---

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const hasCompressionStream =
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

// Decompression-bomb guard: a tiny crafted token (a few KB of highly
// repetitive gzip) can inflate to hundreds of MB and freeze or crash the tab
// of whoever opens the link. Legit share payloads are bounded far below this
// (the share URL itself is capped around 12 KB), so 5 MB of decompressed JSON
// leaves enormous headroom while still neutralizing bombs. Exceeding the cap
// is treated like any other corrupt token (fail-soft -> null).
export const MAX_DECODED_BYTES = 5 * 1024 * 1024;

async function gzipBytes(bytes) {
  const cs = new CompressionStream('gzip');
  const stream = new Response(bytes).body.pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// Inflate with a hard cap on the output size: read the stream chunk by chunk
// and bail out the moment the running total crosses MAX_DECODED_BYTES, instead
// of buffering the whole (potentially huge) result like Response.arrayBuffer()
// would.
async function gunzipBytes(bytes) {
  const ds = new DecompressionStream('gzip');
  const stream = new Response(bytes).body.pipeThrough(ds);
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DECODED_BYTES) {
      try { await reader.cancel(); } catch (e) { /* already failing */ }
      throw new Error('decompressed share payload exceeds size limit');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Encode a JSON string into a URL-safe token (with a leading codec marker).
 * @param {string} jsonString
 * @returns {Promise<string>} the token, or '' for invalid input.
 */
export async function encodeWorkflow(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString) return '';
  const envelope = JSON.stringify({
    v: FORMAT_VERSION,
    ts: Math.floor(Date.now() / 1000),
    w: jsonString,
  });
  const utf8 = new TextEncoder().encode(envelope);
  if (hasCompressionStream) {
    try {
      const gz = await gzipBytes(utf8);
      return String(FORMAT_VERSION) + CODEC_GZIP + bytesToBase64Url(gz);
    } catch (e) {
      // Fall through to the raw path if compression unexpectedly fails.
    }
  }
  return String(FORMAT_VERSION) + CODEC_RAW + bytesToBase64Url(utf8);
}

/**
 * Decode a token produced by encodeWorkflow back into the JSON string.
 * Fail-soft: returns null on any malformed/corrupt input rather than throwing,
 * so a bad link can never crash the app on load.
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function decodeWorkflow(token) {
  const res = await decodeShare(token);
  return res.json;
}

/**
 * Version-aware decode with a structured result, so callers can tell a link
 * made by a newer app version apart from a corrupt one:
 *   { json: string|null, version: number, error: null|'unsupported-version'|'corrupt' }
 * Never throws.
 * @param {string} token
 */
export async function decodeShare(token) {
  if (typeof token !== 'string' || token.length < 2) {
    return { json: null, version: 0, error: 'corrupt' };
  }

  // Split off a leading version number (digits). Legacy tokens start straight
  // at the codec char, which is never a digit.
  const m = /^(\d+)/.exec(token);
  const version = m ? parseInt(m[1], 10) : 0;
  const rest = m ? token.slice(m[1].length) : token;

  const text = await decodePayload(rest);
  if (text === null) return { json: null, version, error: 'corrupt' };

  // Legacy: the payload IS the workflow JSON string.
  if (version === 0) return { json: text, version, error: null };

  // Versioned: the payload is an envelope; `w` carries the workflow JSON
  // string in every version (the forward-compat contract).
  try {
    const envelope = JSON.parse(text);
    const w = envelope && envelope.w;
    const json = typeof w === 'string' ? w : (w && typeof w === 'object' ? JSON.stringify(w) : null);
    if (json) return { json, version, error: null };
    return {
      json: null,
      version,
      error: version > FORMAT_VERSION ? 'unsupported-version' : 'corrupt',
    };
  } catch (e) {
    return {
      json: null,
      version,
      error: version > FORMAT_VERSION ? 'unsupported-version' : 'corrupt',
    };
  }
}

// Reverse the codec layer: "<codec char><base64url>" -> decoded text, or null.
async function decodePayload(rest) {
  if (typeof rest !== 'string' || rest.length < 2) return null;
  const codec = rest[0];
  const payload = rest.slice(1);
  try {
    const bytes = base64UrlToBytes(payload);
    // The raw path can't "expand", but cap it anyway so both codecs share the
    // same upper bound on what a token may hand to JSON.parse.
    if (bytes.length > MAX_DECODED_BYTES) return null;
    if (codec === CODEC_GZIP) {
      if (!hasCompressionStream) return null; // can't inflate without the API
      const out = await gunzipBytes(bytes);
      return new TextDecoder().decode(out);
    }
    if (codec === CODEC_RAW) {
      return new TextDecoder().decode(bytes);
    }
    return null; // unknown codec marker
  } catch (e) {
    return null;
  }
}

/**
 * Build a full shareable URL for the current page carrying the token in the
 * hash. Uses origin + pathname so query/hash leftovers are dropped.
 * @param {string} token
 * @param {Location|{origin:string,pathname:string}} [loc]
 * @returns {string}
 */
export function buildShareUrl(token, loc = (typeof location !== 'undefined' ? location : null)) {
  const origin = loc && loc.origin ? loc.origin : '';
  const pathname = loc && loc.pathname ? loc.pathname : '/';
  return origin + pathname + '#' + HASH_PREFIX + token;
}

/**
 * Read the share token from a hash string (e.g. location.hash). Returns the
 * token, or null when the hash isn't a share link.
 * @param {string} [hash] defaults to location.hash
 * @returns {string|null}
 */
export function readShareParam(hash = (typeof location !== 'undefined' ? location.hash : '')) {
  if (typeof hash !== 'string') return null;
  const h = hash.charAt(0) === '#' ? hash.slice(1) : hash;
  if (!h.startsWith(HASH_PREFIX)) return null;
  const token = h.slice(HASH_PREFIX.length);
  return token || null;
}
