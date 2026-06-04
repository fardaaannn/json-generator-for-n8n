import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'n8n_gen_theme'

/** Resolve the initial theme: stored preference, else OS preference. */
export function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch (e) { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}

/**
 * Theme hook: reads the theme already applied to <html> (set by the inline
 * boot script to avoid a flash), and lets the user toggle it.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset && document.documentElement.dataset.theme) {
      return document.documentElement.dataset.theme
    }
    return resolveInitialTheme()
  })

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch (e) { /* ignore */ }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme, setTheme }
}
