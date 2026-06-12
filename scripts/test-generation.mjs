#!/usr/bin/env node
/**
 * Tes GENERASI sungguhan: memanggil tiap provider memakai buildRequest yang
 * SAMA PERSIS dengan aplikasi (src/lib/providers.js), supaya ketahuan apakah
 * aplikasi benar-benar bisa menghasilkan output dengan key + model tersebut.
 *
 * Prompt sangat pendek + output dibatasi kecil agar biaya minimal.
 */
import { PROVIDERS } from '../src/lib/providers.js';
import { SYSTEM_PROMPT } from '../src/lib/pipeline.js';

const PROMPT = 'Reply with exactly one word: OK';

// Model termurah/teraman per provider untuk dites. Ditulis eksplisit (bukan
// indeks seperti models[2]) supaya tidak berubah diam-diam kalau urutan daftar
// di providers.js diubah; pickModel memastikan id-nya masih ada di daftar.
function pickModel(providerId, preferred) {
  const list = PROVIDERS[providerId].models;
  return list.includes(preferred) ? preferred : list[0];
}
const TEST = [
  { id: 'anthropic', model: pickModel('anthropic', 'claude-haiku-4-5-20251001'), key: process.env.ANTHROPIC_API_KEY },
  { id: 'openai', model: 'gpt-4o-mini', key: process.env.OPENAI_API_KEY },
  { id: 'groq', model: pickModel('groq', 'llama-3.1-8b-instant'), key: process.env.GROQ_API_KEY },
  { id: 'openrouter', model: pickModel('openrouter', 'google/gemini-2.5-flash'), key: process.env.OPENROUTER_API_KEY },
  { id: 'custom', model: process.env.CUSTOM_MODEL || 'gpt-4o-mini', key: process.env.CUSTOM_API_KEY, base: process.env.CUSTOM_BASE_URL },
];

function patchedBody(reqBody) {
  // batasi max_tokens supaya murah (app pakai 8000)
  try {
    const obj = JSON.parse(reqBody);
    obj.max_tokens = 16;
    return JSON.stringify(obj);
  } catch {
    return reqBody;
  }
}

async function main() {
  console.log('\n=== Tes Generasi (mirip aplikasi) ===\n');
  for (const t of TEST) {
    const p = PROVIDERS[t.id];
    if (!t.key && t.id !== 'custom') {
      console.log(`- ${p.name.padEnd(24)} : DILEWATI (env kosong)`);
      continue;
    }
    if (t.id === 'custom' && (!t.key || !t.base)) {
      console.log(`- ${p.name.padEnd(24)} : DILEWATI (CUSTOM_API_KEY/CUSTOM_BASE_URL kosong)`);
      continue;
    }
    const req = p.buildRequest(t.model, PROMPT, t.key, t.base, SYSTEM_PROMPT);
    process.stdout.write(`- ${(p.name + ' [' + t.model + ']').padEnd(46)} : `);
    try {
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: patchedBody(req.body) });
      const text = await res.text();
      if (!res.ok) {
        let msg = text.slice(0, 220);
        try { const j = JSON.parse(text); msg = j.error?.message || j.error?.type || JSON.stringify(j.error || j).slice(0, 220); } catch {}
        console.log(`GAGAL (HTTP ${res.status}) -> ${msg}`);
        continue;
      }
      let data; try { data = JSON.parse(text); } catch { data = null; }
      const out = data ? p.extract(data) : '(tak bisa parse)';
      console.log(`OK -> "${String(out).trim().slice(0, 40)}"`);
    } catch (err) {
      console.log(`ERROR -> ${err.message}`);
    }
  }
  console.log('');
}

main();
