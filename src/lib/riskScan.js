// Exfil-shape scan: inspect a parsed workflow for nodes whose *content* could
// move data somewhere unexpected once the workflow runs inside n8n.
//
// Context (see PROMPT_INJECTION_REPORT.md): the app never executes node
// content — a hostile description can only influence the *data* of the
// workflow the user reviews. The residual risk is a user importing and
// activating a workflow without noticing that one node posts data to an
// attacker's server or that a Code node reads credentials from the
// environment. This scan makes those shapes visible in the UI before import.
//
// Purely informational: nothing is blocked, the user just gets a heads-up.
// Pure + dependency-free so it is trivially unit-testable.

const HTTP_TYPE_RE = /httpRequest$/i;
const CODE_TYPE_RE = /\.(code|function|functionItem)$/i;

// Methods that carry a body — the classic exfil shape is "POST my data to a
// host the description chose". Plain GETs are how most legit API workflows
// fetch data, so they are left alone to avoid warning fatigue.
const SENDING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

// Signals inside Code/Function node source that deserve a second look.
const ENV_RE = /\bprocess\.env\b|\$env\b/;
const NET_RE = /\bfetch\s*\(|\brequire\s*\(\s*['"](?:https?|net|child_process)['"]\s*\)|\bXMLHttpRequest\b|\baxios\b/;

function hostOf(url) {
  if (typeof url !== 'string') return null;
  const m = /^https?:\/\/([^/?#\s]+)/i.exec(url.trim());
  return m ? m[1] : null;
}

// Collect every string value in a parameters object (depth-limited so a
// pathological structure can't recurse forever).
function collectStrings(value, depth = 0, out = []) {
  if (depth > 6 || out.length > 200) return out;
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, depth + 1, out);
  } else if (value && typeof value === 'object') {
    for (const k in value) collectStrings(value[k], depth + 1, out);
  }
  return out;
}

/**
 * Scan a parsed workflow object for exfil-shaped nodes.
 * @param {object} workflow parsed workflow ({ nodes: [...] })
 * @returns {{name: string, kind: 'sendsData'|'readsEnv'|'netCode', host?: string}[]}
 *   one entry per (node, signal); empty array when nothing stands out.
 */
export function findRiskyNodes(workflow) {
  const nodes = workflow && Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const findings = [];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const type = typeof node.type === 'string' ? node.type : '';
    const name = typeof node.name === 'string' ? node.name : type || 'node';
    const params = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};

    if (HTTP_TYPE_RE.test(type)) {
      const method = String(params.method || 'GET').toUpperCase();
      const host = hostOf(params.url);
      if (host && SENDING_METHODS.has(method)) {
        findings.push({ name, kind: 'sendsData', host });
      }
    }

    if (CODE_TYPE_RE.test(type)) {
      const source = collectStrings(params).join('\n');
      if (ENV_RE.test(source)) findings.push({ name, kind: 'readsEnv' });
      if (NET_RE.test(source)) findings.push({ name, kind: 'netCode' });
    }
  }

  return findings;
}

/** Names of flagged nodes (deduplicated), for badging in the preview. */
export function riskyNodeNames(findings) {
  return [...new Set(findings.map((f) => f.name))];
}
