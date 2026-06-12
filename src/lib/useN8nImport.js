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
 * SECURITY: like the provider API key, the n8n URL and API key are stored in
 * localStorage in plaintext when "remember" is enabled. This is an inherent
 * trade-off of a no-backend, bring-your-own-key tool and is opt-in (off by
 * default); any XSS on this origin could read these values, so avoid
 * introducing untrusted scripts/markup on the page.
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
  // The n8n workflow id of the last successful import this session. While
  // set, the UI offers "update in n8n" so refine -> re-import doesn't create
  // duplicates. Session-only on purpose: a persisted id could silently
  // overwrite a workflow on a different visit.
  const [linkedId, setLinkedId] = useState(null)

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
  // a new run starts so stale success banners don't linger. Refine keeps the
  // linked workflow id (same logical workflow, just improved); generating a
  // brand-new workflow, pasting JSON, or restoring history drops the link so
  // "update" can never hit an unrelated workflow.
  const reset = useCallback((kind) => {
    setN8nResult(null)
    setN8nError('')
    if (kind !== 'refine') setLinkedId(null)
  }, [])

  /**
   * Import the workflow into n8n. mode 'create' posts a new workflow;
   * mode 'update' (only offered while a linked id exists) PUTs the previously
   * imported one so refine iterations don't pile up duplicates.
   */
  const importWorkflow = useCallback(async (workflowObj, { mode = 'create' } = {}) => {
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
    const workflowId = mode === 'update' ? linkedId : undefined
    setN8nImporting(true)
    try {
      const { id, updated } = await importToN8n({ baseUrl: n8nUrl, apiKey: n8nApiKey, workflow: workflowObj, workflowId }, t)
      const base = n8nUrl.trim().replace(/\/+$/, '')
      setN8nResult({ id, updated, url: id ? base + '/workflow/' + id : '' })
      if (id) setLinkedId(id)
    } catch (e) {
      // A dead link (workflow deleted in n8n) is dropped so the next attempt
      // creates a fresh workflow instead of failing forever.
      if (workflowId && e.message === t('errN8nGone')) setLinkedId(null)
      setN8nError(e.message)
    } finally {
      setN8nImporting(false)
    }
  }, [n8nUrl, n8nApiKey, linkedId, t])

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
    linkedId,
    reset,
  }
}
