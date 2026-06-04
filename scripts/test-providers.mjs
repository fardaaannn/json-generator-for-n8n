#!/usr/bin/env node
/**
 * Test konektivitas & validitas API key untuk setiap AI provider.
 *
 * Skrip ini TIDAK menyimpan key apa pun. Key dibaca dari environment variable:
 *   ANTHROPIC_API_KEY   -> Anthropic (Claude)
 *   OPENAI_API_KEY      -> OpenAI (GPT)
 *   GROQ_API_KEY        -> Groq
 *   OPENROUTER_API_KEY  -> OpenRouter
 *   CUSTOM_API_KEY      -> Custom / OpenAI-compatible (butuh CUSTOM_BASE_URL juga)
 *   CUSTOM_BASE_URL     -> base URL untuk provider custom (mis. https://host/v1)
 *
 * Cara pakai:
 *   ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... node scripts/test-providers.mjs
 * atau set semua env lalu:
 *   npm run test:keys
 *
 * Endpoint yang dipakai bersifat read-only (daftar model / info key), jadi
 * TIDAK memakai token dan tidak menimbulkan biaya generasi.
 */

const TIMEOUT_MS = 20000;

function mask(key) {
  if (!key) return '(kosong)';
  if (key.length <= 12) return key.slice(0, 2) + '***';
  return key.slice(0, 6) + '...' + key.slice(-4);
}

async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function bodySnippet(res) {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const j = JSON.parse(text);
      const msg = j.error?.message || j.error || j.message;
      return typeof msg === 'string' ? msg : JSON.stringify(j).slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return '';
  }
}

function interpret(status) {
  if (status === 200) return { ok: true, label: 'OK - key valid' };
  if (status === 401) return { ok: false, label: 'GAGAL - key tidak valid / unauthorized (401)' };
  if (status === 403) return { ok: false, label: 'GAGAL - terlarang / tidak ada akses (403)' };
  if (status === 404) return { ok: false, label: 'PERLU CEK - endpoint tidak ditemukan (404)' };
  if (status === 429) return { ok: true, label: 'KEY DIKENALI tapi kena rate limit / kuota habis (429)' };
  return { ok: false, label: `GAGAL - HTTP ${status}` };
}

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    env: 'ANTHROPIC_API_KEY',
    run: (key) =>
      fetchWithTimeout('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      }),
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    env: 'OPENAI_API_KEY',
    run: (key) =>
      fetchWithTimeout('https://api.openai.com/v1/models', {
        headers: { Authorization: 'Bearer ' + key },
      }),
  },
  {
    id: 'groq',
    name: 'Groq',
    env: 'GROQ_API_KEY',
    run: (key) =>
      fetchWithTimeout('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: 'Bearer ' + key },
      }),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    env: 'OPENROUTER_API_KEY',
    run: (key) =>
      fetchWithTimeout('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: 'Bearer ' + key },
      }),
  },
  {
    id: 'custom',
    name: 'Custom / OpenAI-compat',
    env: 'CUSTOM_API_KEY',
    run: (key) => {
      const base = (process.env.CUSTOM_BASE_URL || '').replace(/\/+$/, '');
      if (!base) {
        return Promise.reject(new Error('CUSTOM_BASE_URL belum di-set'));
      }
      return fetchWithTimeout(base + '/models', {
        headers: key ? { Authorization: 'Bearer ' + key } : {},
      });
    },
  },
];

async function main() {
  console.log('\n=== Tes API Key Provider ===\n');
  const results = [];

  for (const p of PROVIDERS) {
    const key = process.env[p.env];
    if (!key && p.id !== 'custom') {
      results.push({ name: p.name, status: 'DILEWATI', detail: `set ${p.env} untuk mengetes` });
      console.log(`- ${p.name.padEnd(26)} : DILEWATI (env ${p.env} kosong)`);
      continue;
    }
    if (p.id === 'custom' && !process.env.CUSTOM_BASE_URL) {
      results.push({ name: p.name, status: 'DILEWATI', detail: 'set CUSTOM_BASE_URL (+ CUSTOM_API_KEY)' });
      console.log(`- ${p.name.padEnd(26)} : DILEWATI (CUSTOM_BASE_URL kosong)`);
      continue;
    }

    process.stdout.write(`- ${p.name.padEnd(26)} : mengetes (key ${mask(key)}) ... `);
    try {
      const res = await p.run(key);
      const verdict = interpret(res.status);
      let detail = verdict.label;
      if (!verdict.ok || res.status === 429) {
        const snippet = await bodySnippet(res);
        if (snippet) detail += ` -> ${snippet}`;
      }
      results.push({ name: p.name, status: verdict.ok ? 'OK' : 'GAGAL', detail });
      console.log(detail);
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'timeout' : err.message;
      results.push({ name: p.name, status: 'ERROR', detail: msg });
      console.log(`ERROR - ${msg}`);
    }
  }

  console.log('\n=== Ringkasan ===');
  for (const r of results) {
    console.log(`${r.status.padEnd(9)} | ${r.name}`);
  }
  console.log('');

  const anyFail = results.some((r) => r.status === 'GAGAL' || r.status === 'ERROR');
  process.exit(anyFail ? 1 : 0);
}

main();
