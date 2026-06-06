import { useState, useEffect, useCallback } from 'react'
import { importToN8n } from './pipeline'

/**
 * Optional Tier 2 feature: import a generated workflow directly into the user's
 * own n8n instance. Encapsulates all of the n8n-import UI state, the
 * remember-credentials persistence, and the import request so App stays lean.
 *
 * The credentials are persisted to localStorage only while "remember" is on.
 * The persistence effect depends on `rememberN8n` as well as the values so it
 * can't write with a stale toggle (the previous inline effect omitted it).
 *
 * @param {{ t: (key: string, params?: object) => string }} args
 */
export function useN8nImport({ t }) {
  const [showN8nImport, setShowN8nImport] = useState(false)
  const [n8nUrl, setN8nUrl] = useState('')
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [rememberN8n, setRememberN8n] = useState(false)
  const [showN8nKey, setShowN8nKey] = useState(false)
  const [n8nImporting, setN8nImporting] = useState(false)
  const [n8nResult, setN8nResult] = useState(null)
  const [n8nError, setN8nError] = useState('')

  // Restore remembered credentials on mount.
  useEffect(() => {
    const storedN8nRemember = localStorage.getItem('n8n_gen_n8n_remember')
    if (storedN8nRemember === 'true') {
      const storedUrl = localStorage.getItem('n8n_gen_n8n_url')
      const storedN8nKey = localStorage.getItem('n8n_gen_n8n_key')
      if (storedUrl || storedN8nKey) {
        if (storedUrl) setN8nUrl(storedUrl)
        if (storedN8nKey) setN8nApiKey(storedN8nKey)
        setRememberN8n(true)
        setShowN8nImport(true)
      }
    }
  }, [])

  // Keep the stored credentials in sync while "remember" is enabled.
  useEffect(() => {
    if (rememberN8n) {
      localStorage.setItem('n8n_gen_n8n_url', n8nUrl)
      localStorage.setItem('n8n_gen_n8n_key', n8nApiKey)
      localStorage.setItem('n8n_gen_n8n_remember', 'true')
    }
  }, [n8nUrl, n8nApiKey, rememberN8n])

  const handleRememberN8nChange = useCallback((e) => {
    const checked = e.target.checked
    setRememberN8n(checked)
    if (checked) {
      localStorage.setItem('n8n_gen_n8n_url', n8nUrl)
      localStorage.setItem('n8n_gen_n8n_key', n8nApiKey)
      localStorage.setItem('n8n_gen_n8n_remember', 'true')
    } else {
      localStorage.removeItem('n8n_gen_n8n_url')
      localStorage.removeItem('n8n_gen_n8n_key')
      localStorage.setItem('n8n_gen_n8n_remember', 'false')
    }
  }, [n8nUrl, n8nApiKey])

  // Clear any previous import result/error. Called by the generation hook when
  // a new generate/refine run starts so stale success banners don't linger.
  const reset = useCallback(() => {
    setN8nResult(null)
    setN8nError('')
  }, [])

  const importWorkflow = useCallback(async (workflowObj) => {
    setN8nError('')
    setN8nResult(null)
    if (!workflowObj) {
      setN8nError(t('errN8nNoWorkflow'))
      return
    }
    if (!n8nUrl.trim()) {
      setN8nError(t('errN8nNoUrl'))
      return
    }
    if (!n8nApiKey) {
      setN8nError(t('errN8nNoKey'))
      return
    }
    setN8nImporting(true)
    try {
      const { id } = await importToN8n({ baseUrl: n8nUrl, apiKey: n8nApiKey, workflow: workflowObj }, t)
      const base = n8nUrl.trim().replace(/\/+$/, '')
      setN8nResult({ id, url: id ? base + '/workflow/' + id : '' })
    } catch (e) {
      setN8nError(e.message)
    } finally {
      setN8nImporting(false)
    }
  }, [n8nUrl, n8nApiKey, t])

  return {
    showN8nImport, setShowN8nImport,
    n8nUrl, setN8nUrl,
    n8nApiKey, setN8nApiKey,
    rememberN8n,
    showN8nKey, setShowN8nKey,
    n8nImporting,
    n8nResult,
    n8nError, setN8nError,
    handleRememberN8nChange,
    importWorkflow,
    reset,
  }
}
