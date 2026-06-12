// Pre-share secret scan: before a workflow is encoded into a share link (or
// submitted to the public gallery), check the JSON text for things that look
// like credentials. A share link embeds the whole workflow in the URL, so any
// API key or token sitting in a node parameter would be handed to everyone the
// link reaches — this scan exists to warn the author *before* that happens.
//
// Design notes:
// - This is a best-effort tripwire, not a guarantee: it matches well-known
//   token shapes plus suspicious "secret-named field with a long opaque value"
//   assignments. False negatives are possible; false positives are kept rare
//   by requiring distinctive prefixes or secret-ish key names.
// - Pure + dependency-free so it can run synchronously in the click handler
//   and be unit-tested in isolation.

// Well-known token shapes. Each pattern carries a human-readable kind used in
// the warning message. Order matters: more specific prefixes come first so a
// token is reported under its most precise kind.
const TOKEN_PATTERNS = [
  { kind: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/ },
  { kind: 'OpenRouter API key', re: /\bsk-or-[A-Za-z0-9_-]{16,}\b/ },
  { kind: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { kind: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { kind: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: 'AWS access key ID', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { kind: 'Google API key', re: /\bAIza[A-Za-z0-9_-]{30,}\b/ },
  { kind: 'Stripe key', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { kind: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { kind: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { kind: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/ },
];

// Generic catch: a JSON field whose *name* says "secret" holding a long
// opaque value, e.g. "apiKey": "d41d8cd98f00b204e9800998ecf8427e". Requires
// both the secret-ish key name and a value with no spaces of >= 16 chars, so
// ordinary prose ("description": "uses the api key from settings") never trips.
const SECRET_FIELD_RE =
  /"((?:[A-Za-z0-9_-]*(?:api[_-]?key|apikey|secret|token|password|passwd|credential|auth)[A-Za-z0-9_-]*))"\s*:\s*"([^"\s]{16,})"/gi;

// Values that look like placeholders/expressions, not real secrets — n8n
// expressions ({{ $credentials... }}), env references, template markers.
const PLACEHOLDER_RE = /^(?:\{\{.*\}\}|=?\{\{.*|\$\{.*\}|<[^>]+>|\*{3,}|x{6,}|your[_-]?|REPLACE|TODO|EXAMPLE|PLACEHOLDER|\[.*\])/i;

function redact(value) {
  const s = String(value);
  if (s.length <= 8) return s[0] + '…';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

/**
 * Scan a workflow JSON string for likely secrets.
 * @param {string} jsonString the exact text that would be shared
 * @returns {{kind: string, preview: string}[]} one entry per distinct finding
 *   (deduplicated by matched value); empty array when nothing looks secret.
 */
export function findSecrets(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString) return [];
  const findings = [];
  const seen = new Set();

  for (const { kind, re } of TOKEN_PATTERNS) {
    // Scan globally per pattern while keeping the declared regexes simple.
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(jsonString)) !== null) {
      const value = m[0];
      if (seen.has(value)) continue;
      seen.add(value);
      findings.push({ kind, preview: redact(value) });
    }
  }

  let m;
  SECRET_FIELD_RE.lastIndex = 0;
  while ((m = SECRET_FIELD_RE.exec(jsonString)) !== null) {
    const [, key, value] = m;
    if (seen.has(value)) continue; // already reported under a specific kind
    if (PLACEHOLDER_RE.test(value)) continue;
    seen.add(value);
    findings.push({ kind: `"${key}" field`, preview: redact(value) });
  }

  return findings;
}

/** Short human summary ("OpenAI API key (sk-p…3aF2), \"apiKey\" field (d41d…27e1)"). */
export function describeFindings(findings) {
  return findings.map((f) => `${f.kind} (${f.preview})`).join(', ');
}
