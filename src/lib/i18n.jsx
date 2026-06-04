import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const translations = {
  id: {
    // Header / language
    langName: 'ID',
    switchLang: 'Ganti bahasa',
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
    unnamed: 'tanpa nama',
    errJsonInvalid: 'JSON tidak valid. Coba sederhanakan deskripsi.',
  },
  en: {
    // Header / language
    langName: 'EN',
    switchLang: 'Switch language',
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
    unnamed: 'unnamed',
    errJsonInvalid: 'Invalid JSON. Try simplifying the description.',
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
