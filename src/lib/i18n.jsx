import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const translations = {
  id: {
    // Header / language
    langName: 'ID',
    switchLang: 'Ganti bahasa',
    toggleTheme: 'Ganti tema terang/gelap',
    // Hero
    heroBadge: 'Generator workflow n8n berbasis AI',
    heroTitle1: 'Buat workflow n8n',
    heroTitle2: 'dari deskripsi teks',
    heroDesc: 'Deskripsikan automasi yang kamu mau — AI akan generate JSON workflow n8n yang siap di-import, lengkap dengan nodes, connections, dan konfigurasi.',
    // Description card
    descCardTitle: 'Deskripsi workflow',
    describeLabel: 'Jelaskan workflow yang kamu mau',
    descPlaceholder: 'Contoh: Buat workflow yang menerima webhook, filter data berdasarkan status, lalu kirim notifikasi ke Slack dan simpan ke Google Sheets...',
    charCount: '{n} karakter',
    quickExamples: 'Contoh cepat',
    // Provider
    aiProvider: 'AI Provider',
    provider: 'Provider',
    model: 'Model',
    customOther: 'Custom / Lainnya',
    modelName: 'Nama model',
    modelNamePlaceholder: 'gpt-4o / llama3 / dll',
    apiKey: 'API Key',
    required: '(wajib)',
    rememberKey: 'Ingat API key di browser ini',
    securityDirect: 'API key kamu tidak pernah dikirim ke server kami. Request langsung dari browser kamu ke provider AI.',
    securityRemember: 'Key disimpan di localStorage browser ini. Jangan gunakan di komputer publik atau shared device.',
    baseUrl: 'Base URL',
    baseUrlHint: '(tanpa /chat/completions)',
    directConnection: 'Koneksi langsung',
    // Options
    options: 'Opsi',
    wfName: 'Nama workflow',
    n8nVersion: 'Versi n8n',
    versionLatest: '1.x (terbaru)',
    versionLegacy: '0.x (lama)',
    complexity: 'Kompleksitas',
    complexitySimple: 'Sederhana',
    complexityMedium: 'Menengah',
    complexityComplex: 'Lengkap + error handling',
    commentLang: 'Bahasa komentar',
    optIndonesian: 'Indonesia',
    optEnglish: 'English',
    // Actions / output
    generateBtn: 'Generate workflow JSON',
    generating: 'Generating...',
    outputTitle: 'Output JSON',
    copy: 'Salin',
    copied: '\u2713 Tersalin',
    download: 'Download',
    outputPlaceholder: 'JSON n8n akan muncul di sini setelah kamu generate workflow',
    viewToggle: 'Tampilan output',
    viewJson: 'JSON',
    viewPreview: 'Preview',
    previewEmpty: 'Tidak ada node untuk ditampilkan',
    previewAria: 'Diagram workflow',
    refineLabel: 'Ubah workflow ini (perintah lanjutan)',
    refinePlaceholder: 'Contoh: tambahkan node Slack setelah filter, atau ganti trigger jadi schedule',
    refineBtn: 'Refine',
    refining: 'Memproses...',
    historyTitle: 'Riwayat generasi',
    historyNodes: '{n} nodes',
    historyClear: 'Hapus riwayat',
    // Status
    statusReady: 'Siap',
    statusGenerating: 'Membuat workflow...',
    statusDone: 'Selesai — {n} nodes',
    statusDoneWarn: 'Selesai — {n} nodes (ada peringatan)',
    statusError: 'Error',
    // Warnings / errors
    warningTitle: 'Perhatian:',
    warningBody: 'JSON mungkin perlu perbaikan manual sebelum di-import ke n8n.',
    errEnterDesc: 'Masukkan deskripsi workflow dulu ya!',
    errEnterRefine: 'Tulis instruksi perubahannya dulu ya!',
    errEnterModel: 'Masukkan nama model',
    errEnterApiKey: 'Masukkan API key untuk provider {provider}',
    errEnterBaseUrl: 'Masukkan Base URL untuk custom provider',
    errGenerateFailed: 'Gagal generate: {msg}',
    // pipeline
    warnNodesArray: '"nodes" harus berupa array',
    warnNodeNoId: 'Node #{n} ({name}) tidak memiliki id',
    warnNodeNoType: 'Node #{n} ({name}) tidak memiliki type',
    warnNodeNoPos: 'Node #{n} ({name}) tidak memiliki position',
    warnConnections: '"connections" harus berupa object',
    warnName: '"name" harus berupa string',
    warnRepaired: 'Output JSON tidak lengkap dan diperbaiki otomatis \u2014 periksa kembali isinya.',
    warnDupId: 'Ada id node duplikat: {id}',
    warnNodeTypeFormat: 'Node #{n} ({name}) punya format type tidak lazim: {type}',
    warnNodeTypeUnknown: 'Node #{n} ({name}) memakai type yang tidak dikenal: {type} \u2014 mungkin keliru/typo, periksa di n8n.',
    warnNodeNoParams: 'Node #{n} ({name}) tidak memiliki parameters',
    warnConnUnknownSource: 'Connection merujuk node sumber yang tidak ada: {name}',
    warnConnUnknownTarget: 'Connection merujuk node tujuan yang tidak ada: {name}',
    unnamed: 'tanpa nama',
    errJsonInvalid: 'JSON tidak valid. Coba sederhanakan deskripsi.',
    errTimeout: 'Permintaan melebihi batas waktu ({s} detik). Coba lagi atau sederhanakan deskripsi.',
    errNetwork: 'Gangguan jaringan: {msg}',
    // password toggle
    showKey: 'Tampilkan API key',
    hideKey: 'Sembunyikan API key',
    // n8n direct import (optional)
    n8nImportTitle: 'Import langsung ke n8n',
    optionalTag: 'Opsional',
    n8nImportDesc: 'Fitur opsional. Kirim workflow langsung ke instance n8n kamu lewat REST API \u2014 request berjalan dari browser ke n8n kamu, API key n8n tidak dikirim ke server kami.',
    n8nUrlLabel: 'n8n Base URL',
    n8nUrlHint: '(tanpa /api/v1)',
    n8nKeyLabel: 'n8n API Key',
    n8nRemember: 'Ingat URL & API key n8n di browser ini',
    n8nImportBtn: 'Import ke n8n',
    n8nImporting: 'Mengimpor ke n8n...',
    n8nImportSuccess: 'Berhasil! Workflow sudah dibuat di n8n kamu.',
    n8nOpenWorkflow: 'Buka workflow',
    n8nImportHint: 'Hanya untuk n8n self-hosted yang mengizinkan origin situs ini via N8N_CORS_ALLOW_ORIGIN, dan instance bisa diakses (halaman HTTPS tidak bisa memanggil n8n HTTP/localhost). Kalau gagal, pakai Copy/Download lalu import manual.',
    errN8nNoUrl: 'Masukkan Base URL n8n kamu',
    errN8nNoKey: 'Masukkan API key n8n kamu',
    errN8nNoWorkflow: 'Generate workflow dulu sebelum import',
    errN8nNetwork: 'Tidak bisa terhubung ke n8n. Kemungkinan diblokir CORS atau instance tidak dapat diakses. Pastikan N8N_CORS_ALLOW_ORIGIN mengizinkan situs ini.',
    errN8nAuth: 'API key n8n ditolak \u2014 cek key dan permission-nya.',
    errN8nBadRequest: 'n8n menolak workflow: {msg}',
    errN8nFailed: 'Gagal import ke n8n: {msg}',
    // footer
    footerMessage: 'Dibuat oleh Fardan dan Claude. Kamu ada saran, kritik atau masukan? Boleh banget hubungi kami lewat kontak di bawah yaa. Semangat bikin workflow-nya!!',
    footerSource: 'Repo Github',
    footerDisclaimer: 'Proyek independen, tidak terafiliasi dengan n8n.',
    footerFollow: 'Ikuti saya',
    // references
    refTitle: 'Butuh inspirasi? Koleksi workflow siap pakai',
    refSubtitle: 'Kumpulan workflow n8n dari komunitas yang bisa kamu pelajari atau import langsung.',
    refOpen: 'Buka',
    refDisclaimer: 'Sumber pihak ketiga, bukan afiliasi kami. Selalu periksa isi & lisensi workflow sebelum di-import ke n8n kamu.',
  },
  en: {
    // Header / language
    langName: 'EN',
    switchLang: 'Switch language',
    toggleTheme: 'Toggle light/dark theme',
    // Hero
    heroBadge: 'AI-powered n8n workflow generator',
    heroTitle1: 'Build n8n workflows',
    heroTitle2: 'from a text description',
    heroDesc: 'Describe the automation you want — the AI generates ready-to-import n8n workflow JSON, complete with nodes, connections, and configuration.',
    // Description card
    descCardTitle: 'Workflow description',
    describeLabel: 'Describe the workflow you want',
    descPlaceholder: 'Example: Build a workflow that receives a webhook, filters data by status, then sends a Slack notification and saves it to Google Sheets...',
    charCount: '{n} characters',
    quickExamples: 'Quick examples',
    // Provider
    aiProvider: 'AI Provider',
    provider: 'Provider',
    model: 'Model',
    customOther: 'Custom / Other',
    modelName: 'Model name',
    modelNamePlaceholder: 'gpt-4o / llama3 / etc.',
    apiKey: 'API Key',
    required: '(required)',
    rememberKey: 'Remember API key in this browser',
    securityDirect: 'Your API key is never sent to our servers. Requests go directly from your browser to the AI provider.',
    securityRemember: 'The key is stored in this browser\u2019s localStorage. Do not use this on a public or shared device.',
    baseUrl: 'Base URL',
    baseUrlHint: '(without /chat/completions)',
    directConnection: 'Direct connection',
    // Options
    options: 'Options',
    wfName: 'Workflow name',
    n8nVersion: 'n8n version',
    versionLatest: '1.x (latest)',
    versionLegacy: '0.x (legacy)',
    complexity: 'Complexity',
    complexitySimple: 'Simple',
    complexityMedium: 'Medium',
    complexityComplex: 'Full + error handling',
    commentLang: 'Comment language',
    optIndonesian: 'Indonesian',
    optEnglish: 'English',
    // Actions / output
    generateBtn: 'Generate workflow JSON',
    generating: 'Generating...',
    outputTitle: 'Output JSON',
    copy: 'Copy',
    copied: '\u2713 Copied',
    download: 'Download',
    outputPlaceholder: 'Your n8n JSON will appear here after you generate a workflow',
    viewToggle: 'Output view',
    viewJson: 'JSON',
    viewPreview: 'Preview',
    previewEmpty: 'No nodes to preview',
    previewAria: 'Workflow diagram',
    refineLabel: 'Refine this workflow (follow-up instruction)',
    refinePlaceholder: 'e.g. add a Slack node after the filter, or change the trigger to schedule',
    refineBtn: 'Refine',
    refining: 'Working...',
    historyTitle: 'Generation history',
    historyNodes: '{n} nodes',
    historyClear: 'Clear history',
    // Status
    statusReady: 'Ready',
    statusGenerating: 'Generating workflow...',
    statusDone: 'Done — {n} nodes',
    statusDoneWarn: 'Done — {n} nodes (with warnings)',
    statusError: 'Error',
    // Warnings / errors
    warningTitle: 'Heads up:',
    warningBody: 'The JSON may need manual fixes before importing into n8n.',
    errEnterDesc: 'Please enter a workflow description first!',
    errEnterRefine: 'Please enter a refine instruction first!',
    errEnterModel: 'Please enter a model name',
    errEnterApiKey: 'Please enter an API key for provider {provider}',
    errEnterBaseUrl: 'Please enter a Base URL for the custom provider',
    errGenerateFailed: 'Generation failed: {msg}',
    // pipeline
    warnNodesArray: '"nodes" must be an array',
    warnNodeNoId: 'Node #{n} ({name}) is missing an id',
    warnNodeNoType: 'Node #{n} ({name}) is missing a type',
    warnNodeNoPos: 'Node #{n} ({name}) is missing a position',
    warnConnections: '"connections" must be an object',
    warnName: '"name" must be a string',
    warnRepaired: 'The JSON output was incomplete and auto-repaired \u2014 please review it.',
    warnDupId: 'Duplicate node id found: {id}',
    warnNodeTypeFormat: 'Node #{n} ({name}) has an unusual type format: {type}',
    warnNodeTypeUnknown: 'Node #{n} ({name}) uses an unknown type: {type} \u2014 it may be wrong/mistyped, double-check in n8n.',
    warnNodeNoParams: 'Node #{n} ({name}) is missing parameters',
    warnConnUnknownSource: 'A connection references a source node that does not exist: {name}',
    warnConnUnknownTarget: 'A connection references a target node that does not exist: {name}',
    unnamed: 'unnamed',
    errJsonInvalid: 'Invalid JSON. Try simplifying the description.',
    errTimeout: 'The request timed out ({s} seconds). Try again or simplify the description.',
    errNetwork: 'Network error: {msg}',
    // password toggle
    showKey: 'Show API key',
    hideKey: 'Hide API key',
    // n8n direct import (optional)
    n8nImportTitle: 'Import directly to n8n',
    optionalTag: 'Optional',
    n8nImportDesc: 'Optional feature. Send the workflow straight to your own n8n instance via the REST API \u2014 the request goes from your browser to your n8n, and your n8n API key never touches our servers.',
    n8nUrlLabel: 'n8n Base URL',
    n8nUrlHint: '(without /api/v1)',
    n8nKeyLabel: 'n8n API Key',
    n8nRemember: 'Remember n8n URL & API key in this browser',
    n8nImportBtn: 'Import to n8n',
    n8nImporting: 'Importing to n8n...',
    n8nImportSuccess: 'Success! The workflow was created in your n8n.',
    n8nOpenWorkflow: 'Open workflow',
    n8nImportHint: 'Only works with a self-hosted n8n that allows this site\u2019s origin via N8N_CORS_ALLOW_ORIGIN and is reachable (an HTTPS page cannot call an HTTP/localhost n8n). If it fails, use Copy/Download and import manually.',
    errN8nNoUrl: 'Please enter your n8n Base URL',
    errN8nNoKey: 'Please enter your n8n API key',
    errN8nNoWorkflow: 'Generate a workflow before importing',
    errN8nNetwork: 'Could not reach n8n. It may be blocked by CORS or unreachable. Make sure N8N_CORS_ALLOW_ORIGIN allows this site.',
    errN8nAuth: 'The n8n API key was rejected \u2014 check the key and its permissions.',
    errN8nBadRequest: 'n8n rejected the workflow: {msg}',
    errN8nFailed: 'Failed to import to n8n: {msg}',
    // footer
    footerMessage: 'Made by Fardan and Claude. Got any suggestions, critiques, or feedback? Feel free to reach out via the contacts below. Happy workflow building!!',
    footerSource: 'Github Repo',
    footerDisclaimer: 'An independent project, not affiliated with n8n.',
    footerFollow: 'Follow me',
    // references
    refTitle: 'Need inspiration? Ready-to-use workflow collections',
    refSubtitle: 'Community n8n workflows you can study or import directly.',
    refOpen: 'Open',
    refDisclaimer: 'Third-party sources, not affiliated with us. Always review each workflow\u2019s content & license before importing into your n8n.',
  },
}

/** Build a translator function for a given language. */
export function makeT(lang) {
  const dict = translations[lang] || translations.en
  return (key, params) => {
    let str = dict[key] ?? translations.en[key] ?? key
    if (params) {
      for (const p in params) {
        str = str.replace(new RegExp('\\{' + p + '\\}', 'g'), String(params[p]))
      }
    }
    return str
  }
}

const LanguageContext = createContext(null)

function detectInitialLang() {
  try {
    const stored = localStorage.getItem('n8n_gen_ui_lang')
    if (stored === 'id' || stored === 'en') return stored
  } catch (e) { /* ignore */ }
  if (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('id')) {
    return 'id'
  }
  return 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang)

  useEffect(() => {
    try { localStorage.setItem('n8n_gen_ui_lang', lang) } catch (e) { /* ignore */ }
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l) => setLangState(l), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'id' ? 'en' : 'id')), [])
  const t = useCallback(makeT(lang), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
