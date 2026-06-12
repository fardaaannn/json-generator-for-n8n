import { useState, useEffect, useCallback, useMemo } from 'react'
import { makeT } from './i18nData'
import { LanguageContext } from './useLanguage'

// This module intentionally exports ONLY the provider component. The strings
// and translator factory live in i18nData.js and the consumer hook in
// useLanguage.js, so react-refresh can hot-reload this file reliably
// (react-refresh/only-export-components).

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
  // Memoize the translator itself (rather than wrapping it in useCallback,
  // which mis-stated the dependency contract and tripped exhaustive-deps).
  const t = useMemo(() => makeT(lang), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
