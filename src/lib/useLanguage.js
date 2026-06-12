import { createContext, useContext } from 'react'

// The context lives here (not in i18n.jsx) so both the provider component and
// the consumer hook can share it while each file keeps a single kind of
// export: i18n.jsx exports only the component (react-refresh friendly), this
// module exports only the hook + context.
export const LanguageContext = createContext(null)

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
