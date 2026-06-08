import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './providers'
import {
  sanitizeInput,
  buildPrompt,
  buildRefinePrompt,
  buildRepairPrompt,
  cleanOutput,
  repairJSON,
  normalizeConnections,
  localRepair,
  validateStructure,
  maxTokensFor,
  sendRequest,
  sendRequestStream,
  isResponseFormatError,
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
  // Partial model output shown live while a generate/refine is streaming. Empty
  // when not streaming (or once the final parsed result replaces it).
  const [streamingText, setStreamingText] = useState('')
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
        ? parsed.nodes
            .filter((n) => n && typeof n === 'object')
            .map((n) => ({ name: n.name || n.type, type: n.type }))
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

  // The shared request → extract → clean → repair → (self-heal) → apply path.
  const runRequest = useCallback(async ({ prompt, config, setBusy, onSuccess }) => {
    const cfg = PROVIDERS[config.provider]
    const effectiveModel = config.selectedModel === '__custom__' ? config.customModel : config.selectedModel
    const baseUrlValue = config.provider === 'custom' ? config.baseUrl : undefined
    // Scale the output token budget to complexity so larger workflows don't get
    // truncated mid-JSON. Self-heal is on unless explicitly disabled.
    const maxTokens = config.maxTokens || maxTokensFor(config.complexity)
    const autoFix = config.autoFix !== false

    setBusy(true)
    setErrorMsg('')
    setWarnings([])
    setWasRepaired(false)
    setLastDiff(null)
    setStreamingText('')
    if (onRunStart) onRunStart()
    setStatus({ state: 'active', key: 'statusGenerating', params: {} })

    const buildReq = (modelPrompt, opts) =>
      cfg.buildRequest(effectiveModel, modelPrompt, config.apiKey, baseUrlValue, SYSTEM_PROMPT, maxTokens, opts)

    // Plain (non-streaming) call, transparently retrying without response_format
    // if the model/provider rejects JSON mode (common on some OpenRouter
    // models). Used directly for self-heal and as the streaming fallback.
    const callModelText = async (modelPrompt) => {
      try {
        const data = await sendRequest(buildReq(modelPrompt), t)
        return cfg.extract(data)
      } catch (e) {
        if (isResponseFormatError(e)) {
          const data = await sendRequest(buildReq(modelPrompt, { responseFormat: false }), t)
          return cfg.extract(data)
        }
        throw e
      }
    }

    // Get the model's raw text output. When `stream` is on and the provider
    // supports it, the JSON appears live via setStreamingText; ANY streaming
    // failure (except a real timeout) silently falls back to callModelText, so
    // behaviour never regresses.
    const getModelText = async (modelPrompt, { stream }) => {
      if (!stream || typeof cfg.streamExtract !== 'function') {
        return await callModelText(modelPrompt)
      }
      let lastUpdate = 0
      try {
        const text = await sendRequestStream(
          buildReq(modelPrompt, { stream: true }),
          t,
          {
            onToken: (full) => {
              // Throttle UI updates so a long stream doesn't thrash React.
              const now = Date.now()
              if (now - lastUpdate > 60) { lastUpdate = now; setStreamingText(full) }
            },
          },
          cfg.streamExtract,
        )
        if (text && text.trim()) return text
        // Empty stream (provider ignored it / sent no content) — fall back.
        return await callModelText(modelPrompt)
      } catch (e) {
        // A real timeout already waited the full window; don't wait again.
        if (e && e.isTimeout) throw e
        return await callModelText(modelPrompt)
      }
    }

    try {
      const firstText = await getModelText(prompt, { stream: true })
      const first = repairJSON(cleanOutput(firstText), t)
      let parsed = first.value
      let repaired = first.repaired
      // Fix connections that reference node ids instead of names (some models
      // do this), so links survive import and render in the preview.
      normalizeConnections(parsed)
      // Repair the mechanical issues (missing/duplicate ids, missing positions
      // or parameters) locally first, so a result whose only problems are these
      // never needs the costly self-heal round-trip below.
      localRepair(parsed)
      let resultWarnings = validateStructure(parsed, t)

      // Self-heal: if the first result has validation issues, ask the model
      // ONCE to fix exactly those issues, then keep whichever result is cleaner.
      // Best-effort — a heal failure leaves the original result untouched.
      if (autoFix && resultWarnings.length > 0) {
        setStatus({ state: 'active', key: 'statusFixing', params: {} })
        try {
          const fixPrompt = buildRepairPrompt({
            currentJSON: JSON.stringify(parsed),
            warnings: resultWarnings,
            version: N8N_VERSION,
            lang: config.lang,
          })
          const fixText = await getModelText(fixPrompt, { stream: false })
          const healed = repairJSON(cleanOutput(fixText), t)
          normalizeConnections(healed.value)
          localRepair(healed.value)
          const healedWarnings = validateStructure(healed.value, t)
          if (healedWarnings.length < resultWarnings.length) {
            parsed = healed.value
            repaired = repaired || healed.repaired
            resultWarnings = healedWarnings
          }
        } catch (e) { /* heal is best-effort; keep the original result */ }
      }

      const pretty = JSON.stringify(parsed, null, 2)
      applyResult(parsed, pretty, repaired)
      if (onSuccess) onSuccess(parsed)
    } catch (e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
      setStatus({ state: 'error', key: 'statusError', params: {} })
      setStreamingText('')
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

  // Load a workflow the user pasted in (existing n8n JSON), so they can
  // preview, refine, or import it without generating from scratch. Runs the
  // same normalize + local-repair + validate path as a generated result, so a
  // pasted workflow is treated identically downstream. Returns true on success.
  const loadWorkflow = useCallback((jsonText) => {
    const text = typeof jsonText === 'string' ? jsonText.trim() : ''
    if (!text) {
      setErrorMsg(t('errEnterWorkflowJson'))
      return false
    }
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setErrorMsg(t('errWorkflowJsonInvalid'))
      return false
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.nodes)) {
      setErrorMsg(t('errWorkflowJsonShape'))
      return false
    }
    if (onRunStart) onRunStart()
    setErrorMsg('')
    setLastDiff(null)
    normalizeConnections(parsed)
    localRepair(parsed)
    const pretty = JSON.stringify(parsed, null, 2)
    // Pasted input is taken as-is (not bracket-repaired), so repaired=false.
    applyResult(parsed, pretty, false)
    return true
  }, [t, onRunStart, applyResult])

  const restoreHistory = useCallback((entry) => {
    try {
      const parsed = JSON.parse(entry.json)
      setCurrentJSON(entry.json)
      setWorkflowObj(parsed)
      setNodeTags(Array.isArray(parsed.nodes) ? parsed.nodes.filter((n) => n && typeof n === 'object').map((n) => ({ name: n.name || n.type, type: n.type })) : [])
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
    streamingText,
    refineInstruction, setRefineInstruction,
    history,
    showHistory, setShowHistory,
    lastDiff, setLastDiff,
    generate,
    refine,
    loadWorkflow,
    restoreHistory,
    clearHistory,
  }
}
