import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './providers'
import {
  sanitizeInput,
  buildPrompt,
  buildRefinePrompt,
  cleanOutput,
  repairJSON,
  validateStructure,
  sendRequest,
  SYSTEM_PROMPT,
} from './pipeline'
import { diffWorkflows } from './workflowDiff'

// n8n major version targeted by generated workflows. The user-facing version
// dropdown was removed (0.x is long obsolete); workflows now always target the
// current 1.x line. Kept as a single constant so prompts stay consistent.
const N8N_VERSION = '1.x'

const HISTORY_KEY = 'n8n_gen_history'
const HISTORY_LIMIT = 10

/**
 * Owns everything about producing a workflow: the result/output state, the
 * recent-history list, and the two entry points (generate from a description,
 * refine an existing workflow). generate() and refine() previously duplicated
 * nearly all of their request/parse/validate/apply logic in App; that shared
 * path now lives in a single `runRequest` helper.
 *
 * @param {object} args
 * @param {(key: string, params?: object) => string} args.t  translator
 * @param {() => void} [args.onRunStart]  side-effect to run when a new
 *   generate/refine/restore begins (used to clear the n8n import banner).
 */
export function useWorkflowGeneration({ t, onRunStart }) {
  const [currentJSON, setCurrentJSON] = useState('')
  const [workflowObj, setWorkflowObj] = useState(null)
  const [nodeTags, setNodeTags] = useState([])
  const [outputFilename, setOutputFilename] = useState('workflow.json')
  const [status, setStatus] = useState({ state: '', key: 'statusReady', params: {} })
  const [errorMsg, setErrorMsg] = useState('')
  const [warnings, setWarnings] = useState([])
  const [wasRepaired, setWasRepaired] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  // Summary of what changed in the most recent refine (null until a refine
  // runs, or after it's dismissed / a fresh generation starts).
  const [lastDiff, setLastDiff] = useState(null)

  // Restore the recent-generation history on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, HISTORY_LIMIT))
      }
    } catch (e) { /* ignore corrupted history */ }
  }, [])

  const pushHistory = useCallback((parsed, pretty) => {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: (parsed && typeof parsed.name === 'string' && parsed.name) ? parsed.name : 'workflow',
      nodeCount: Array.isArray(parsed?.nodes) ? parsed.nodes.length : 0,
      ts: Date.now(),
      json: pretty,
    }
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, HISTORY_LIMIT)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch (e) { /* quota */ }
      return next
    })
  }, [])

  // Apply a successfully parsed workflow to the output state. Shared by
  // generate() and refine() so the two stay in lockstep.
  const applyResult = useCallback((parsed, pretty, repaired) => {
    setWasRepaired(repaired)
    const resultWarnings = validateStructure(parsed, t)
    setWarnings(resultWarnings)
    setCurrentJSON(pretty)
    setWorkflowObj(parsed)
    setNodeTags(
      (parsed.nodes && parsed.nodes.length > 0)
        ? parsed.nodes.map((n) => ({ name: n.name || n.type, type: n.type }))
        : []
    )
    const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
    setOutputFilename(wfNameOut + '.json')
    const nodeCount = parsed.nodes?.length || 0
    setStatus({
      state: 'done',
      key: (resultWarnings.length > 0 || repaired) ? 'statusDoneWarn' : 'statusDone',
      params: { n: nodeCount },
    })
    pushHistory(parsed, pretty)
  }, [t, pushHistory])

  // Validate that a usable model + credentials are present for `config`.
  // Returns an error message string when invalid, or null when OK.
  const validateConfig = useCallback((config) => {
    const cfg = PROVIDERS[config.provider]
    const effectiveModel = config.selectedModel === '__custom__' ? config.customModel : config.selectedModel
    if (!effectiveModel) return t('errEnterModel')
    if (!config.apiKey) return t('errEnterApiKey', { provider: cfg.name })
    if (config.provider === 'custom' && !config.baseUrl) return t('errEnterBaseUrl')
    return null
  }, [t])

  // The shared request → extract → clean → repair → apply path.
  const runRequest = useCallback(async ({ prompt, config, setBusy, onSuccess }) => {
    const cfg = PROVIDERS[config.provider]
    const effectiveModel = config.selectedModel === '__custom__' ? config.customModel : config.selectedModel
    const baseUrlValue = config.provider === 'custom' ? config.baseUrl : undefined

    setBusy(true)
    setErrorMsg('')
    setWarnings([])
    setWasRepaired(false)
    setLastDiff(null)
    if (onRunStart) onRunStart()
    setStatus({ state: 'active', key: 'statusGenerating', params: {} })

    try {
      const req = cfg.buildRequest(effectiveModel, prompt, config.apiKey, baseUrlValue, SYSTEM_PROMPT, config.maxTokens)
      const data = await sendRequest(req, t)
      let raw = cfg.extract(data)
      raw = cleanOutput(raw)
      const { value: parsed, repaired } = repairJSON(raw, t)
      const pretty = JSON.stringify(parsed, null, 2)
      applyResult(parsed, pretty, repaired)
      if (onSuccess) onSuccess(parsed)
    } catch (e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
      setStatus({ state: 'error', key: 'statusError', params: {} })
    } finally {
      setBusy(false)
    }
  }, [t, onRunStart, applyResult])

  // Generate a brand-new workflow from a free-text description.
  const generate = useCallback(async (config) => {
    const cleaned = sanitizeInput(config.description)
    if (!cleaned) {
      setErrorMsg(t('errEnterDesc'))
      return
    }
    const configError = validateConfig(config)
    if (configError) {
      setErrorMsg(configError)
      return
    }
    // Clear previous output before a fresh generation.
    setCurrentJSON('')
    setWorkflowObj(null)
    setNodeTags([])
    const prompt = buildPrompt({
      description: cleaned,
      name: config.wfName || 'My Workflow',
      version: N8N_VERSION,
      complexity: config.complexity,
      lang: config.lang,
    })
    await runRequest({ prompt, config, setBusy: setIsGenerating })
  }, [t, validateConfig, runRequest])

  // Apply a free-text instruction to the current workflow.
  const refine = useCallback(async (config) => {
    const instruction = sanitizeInput(refineInstruction)
    if (!instruction) {
      setErrorMsg(t('errEnterRefine'))
      return
    }
    if (!workflowObj || !currentJSON) {
      setErrorMsg(t('errN8nNoWorkflow'))
      return
    }
    const configError = validateConfig(config)
    if (configError) {
      setErrorMsg(configError)
      return
    }
    const prompt = buildRefinePrompt({ currentJSON, instruction, version: N8N_VERSION, lang: config.lang })
    // Capture the workflow as it is *now* so we can report what the refine
    // changed once the model returns the updated version.
    const before = workflowObj
    await runRequest({
      prompt,
      config,
      setBusy: setIsRefining,
      onSuccess: (parsed) => {
        setRefineInstruction('')
        setLastDiff(diffWorkflows(before, parsed))
      },
    })
  }, [refineInstruction, workflowObj, currentJSON, t, validateConfig, runRequest])

  const restoreHistory = useCallback((entry) => {
    try {
      const parsed = JSON.parse(entry.json)
      setCurrentJSON(entry.json)
      setWorkflowObj(parsed)
      setNodeTags(Array.isArray(parsed.nodes) ? parsed.nodes.map((n) => ({ name: n.name || n.type, type: n.type })) : [])
      const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
      setOutputFilename(wfNameOut + '.json')
      setWarnings([])
      setWasRepaired(false)
      setLastDiff(null)
      if (onRunStart) onRunStart()
      setErrorMsg('')
      setStatus({ state: 'done', key: 'statusDone', params: { n: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0 } })
    } catch (e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
    }
  }, [t, onRunStart])

  const clearHistory = useCallback(() => {
    setHistory([])
    try { localStorage.removeItem(HISTORY_KEY) } catch (e) { /* ignore */ }
  }, [])

  return {
    currentJSON,
    workflowObj,
    nodeTags,
    outputFilename,
    status,
    errorMsg, setErrorMsg,
    warnings,
    wasRepaired,
    isGenerating,
    isRefining,
    refineInstruction, setRefineInstruction,
    history,
    showHistory, setShowHistory,
    lastDiff, setLastDiff,
    generate,
    refine,
    restoreHistory,
    clearHistory,
  }
}
