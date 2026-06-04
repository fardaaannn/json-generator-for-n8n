const MAX_DESC = 2000;

export function sanitizeInput(desc) {
  let cleaned = desc.trim();
  if (cleaned.length > MAX_DESC) {
    cleaned = cleaned.substring(0, MAX_DESC);
  }
  const injectionPatterns = [
    /ignore\s+(previous|all|prior)\s+(instructions|directives|commands)/gi,
    /system:\s*/gi,
    /you\s+are\s+(not\s+)?(an?\s+)?(ai|assistant|helper|model)/gi,
    /role[:\s]*override/gi,
    /new\s+instructions/gi,
  ];
  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

export function buildPrompt({description, name, version, complexity, lang}) {
  const complexityDesc = {
    simple: 'Buat workflow sederhana dengan node minimal.',
    medium: 'Buat workflow lengkap dengan konfigurasi parameter yang realistis.',
    complex: 'Buat workflow lengkap dengan error handling, IF node untuk kondisi, dan sticky note penjelasan.'
  };

  return `Kamu adalah expert n8n workflow builder. Generate file JSON workflow n8n yang valid dan siap di-import.

DESKRIPSI WORKFLOW:
${description}

REQUIREMENTS:
- Nama workflow: "${name}"
- Versi n8n: ${version}
- ${complexityDesc[complexity]}
- Komentar/notes dalam bahasa: ${lang === 'id' ? 'Indonesia' : 'English'}
- Gunakan node types yang valid untuk n8n ${version}
- Setiap node harus memiliki id unik, nama deskriptif, type yang benar, dan posisi (x,y)
- Buat connections yang benar antar node

FORMAT OUTPUT:
Langsung output JSON valid saja, tanpa penjelasan, tanpa markdown code block, tanpa backtick.
JSON harus dimulai dengan { dan diakhiri dengan }.
Maksimal 12 nodes.

Struktur:
{"name":"...","nodes":[...],"connections":{...},"active":false,"settings":{},"id":"..."}

WAJIB:
- Output ONLY valid JSON, no markdown/backticks
- Top-level keys: name, nodes, connections, active, settings
- Setiap node harus memiliki: id, name, type, position, parameters`;
}

export function cleanOutput(raw) {
  return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

export function repairJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch(e) {
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace > 0) {
      let fixed = raw.substring(0, lastBrace + 1);
      const opens = (fixed.match(/\[/g)||[]).length - (fixed.match(/\]/g)||[]).length;
      const openBraces = (fixed.match(/\{/g)||[]).length - (fixed.match(/\}/g)||[]).length;
      for(let i=0;i<opens;i++) fixed += ']';
      for(let i=0;i<openBraces;i++) fixed += '}';
      try { return JSON.parse(fixed); }
      catch(e2) { throw new Error('JSON tidak valid. Coba sederhanakan deskripsi.'); }
    }
    throw new Error('JSON tidak valid. Coba sederhanakan deskripsi.');
  }
}

export function validateStructure(parsed) {
  const warnings = [];
  if (!Array.isArray(parsed.nodes)) {
    warnings.push('"nodes" harus berupa array');
  } else {
    parsed.nodes.forEach((n, i) => {
      if (!n.id) warnings.push('Node #' + (i+1) + ' (' + (n.name || 'unnamed') + ') tidak memiliki id');
      if (!n.type) warnings.push('Node #' + (i+1) + ' (' + (n.name || 'unnamed') + ') tidak memiliki type');
      if (!n.position) warnings.push('Node #' + (i+1) + ' (' + (n.name || 'unnamed') + ') tidak memiliki position');
    });
  }
  if (!parsed.connections || typeof parsed.connections !== 'object') {
    warnings.push('"connections" harus berupa object');
  }
  if (typeof parsed.name !== 'string') {
    warnings.push('"name" harus berupa string');
  }
  return warnings;
}
