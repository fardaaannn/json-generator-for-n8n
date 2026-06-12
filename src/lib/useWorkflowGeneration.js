import { useState, useEffect, useCallback, useRef } from 'react'
import { PROVIDERS, DEFAULT_MAX_TOKENS } from './providers'
import {
  sanitizeInput,
  buildPrompt,
  buildRefinePrompt,
  buildRepairPrompt,
  buildStructureRepairPrompt,
  unwrapWorkflow,
  cleanOutput,
  repairJSON,
  normalizeConnections,
  localRepair,
  validateStructure,
  maxTokensFor,
  sendRequest,
  sendRequestStream,
  isResponseFormatError,
  isMaxTokensError,
  assertHttpUrl,
  SYSTEM_PROMPT,
} from './pipeline'
import { diffWorkflows } from './workflowDiff'

// n8n major version targeted by generated workflows. The user-facing version
// dropdown was removed (0.x is long obsolete); workflows now always target the
// current 1.x line. Kept as a single constant so prompts stay consistent.
const N8N_VERSION = '1.x'

const HISTORY_KEY = 'n8n_gen_history'
const HISTORY_LIMIT = 10
// Hard ceiling on total stored entries (pinned + unpinned) so heavy pinning
// can't grow localStorage without bound. Pinned items are exempt from the
// unpinned FIFO limit but still counted toward this cap; once it's reached, a
// new pin is rejected (see togglePin) rather than silently evicting a pin.
const HISTORY_MAX = 30

// Re-apply the storage policy to a history array: pinned entries are kept
// (newest first), unpinned entries are kept newest-first but capped to
// HISTORY_LIMIT. Pinned always sort above unpinned. Pure so it's easy to reason
// about and reuse from both pushHistory and togglePin.
function applyHistoryPolicy(list) {
  const arr = Array.isArray(list) ? list : []
  const pinned = arr.filter((e) => e && e.pinned).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const unpinned = arr.filter((e) => !e || !e.pinned).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return [...pinned, ...unpinned.slice(0, HISTORY_LIMIT)]
}

// Persist the history list. localStorage writes can fail (quota, privacy
// mode); instead of silently giving up — which used to make history stop
// persisting without any signal — retry once with only the pinned entries
// plus the newest few unpinned ones, so persistence degrades gracefully.
function persistHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch (e) {
    try {
      const pinned = list.filter((x) => x && x.pinned)
      const unpinned = list.filter((x) => x && !x.pinned)
      localStorage.setItem(HISTORY_KEY, JSON.stringify([...pinned, ...unpinned.slice(0, 3)]))
    } catch (e2) { /* storage unavailable or still full — keep in-memory only */ }
  }
}

/**
 * Owns everything about producing a workflow: the result/output state, the
 * recent-history list, and the two entry points (generate from a description,
 * refine an existing workflow). generate() and refine() previously duplicated
 * nearly all of their request/parse/validate/apply logic in App; that shared
 * path now lives in a single `runRequest` helper.
 *
 * @param {object} args
 * @param {(key: string, params?: object) => string} args.t  translator
 * @param {(kind?: string) => void} [args.onRunStart]  side-effect to run when a new
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
  // Multi-turn refine context: the original description and the refine
  // instructions successfully applied since the current workflow appeared.
  // Replayed into buildRefinePrompt so later refines know cumulative intent.
  // A ref (not state): it never affects rendering.
  const convoRef = useRef({ description: null, instructions: [] })
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  // Summary of what changed in the most recent refine (null until a refine
  // runs, or after it's dismissed / a fresh generation starts).
  const [lastDiff, setLastDiff] = useState(null)
  // Controller for the in-flight generate/refine, so the user can cancel a
  // request instead of waiting out the full timeout. Null when idle.
  const abortRef = useRef(null)

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
  }, [])

  // Restore the recent-generation history on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setHistory(applyHistoryPolicy(parsed))
      }
    } catch (e) { /* ignore corrupted history */ }
  }, [])

  const pushHistory = useCallback((parsed, pretty) => {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: (parsed && typeof parsed.name === 'string' && parsed.name) ? parsed.name : 'workflow',
      nodeCount: Array.isArray(parsed?.nodes) ? parsed.nodes.length : 0,
      ts: Date.now(),
      pinned: false,
      json: pretty,
    }
    setHistory((prev) => {
      const next = applyHistoryPolicy([entry, ...prev])
      persistHistory(next)
      return next
    })
  }, [])

  // Toggle the pinned flag on a history entry. Pinned entries survive the FIFO
  // limit. Returns false (and makes no change) when trying to pin past the hard
  // ceiling so localStorage can't grow unbounded; toggling OFF always works.
  const togglePin = useCallback((id) => {
    let ok = true
    setHistory((prev) => {
      const target = prev.find((e) => e.id === id)
      if (!target) return prev
      // Block a new pin only when at the ceiling AND we're pinning (not unpinning).
      if (!target.pinned && prev.length >= HISTORY_MAX) { ok = false; return prev }
      const updated = prev.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))
      const next = applyHistoryPolicy(updated)
      persistHistory(next)
      return next
    })
    return ok
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
    if (config.provider === 'custom') {
      if (!config.baseUrl) return t('errEnterBaseUrl')
      // The custom Base URL is user-supplied and the API key is attached to it,
      // so require a real http(s) endpoint before any request is built.
      try {
        assertHttpUrl(config.baseUrl, 'errBaseUrlInvalid', t)
      } catch (e) {
        return e.message
      }
    }
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

    // One controller covers the whole run (first call, fallback, self-heal):
    // a single Cancel press aborts whichever request is in flight.
    const controller = new AbortController()
    abortRef.current = controller
    const signal = controller.signal

    setBusy(true)
    setErrorMsg('')
    setWarnings([])
    setWasRepaired(false)
    setLastDiff(null)
    setStreamingText('')
    if (onRunStart) onRunStart()
    setStatus({ state: 'active', key: 'statusGenerating', params: {} })

    const buildReq = (modelPrompt, opts, budget = maxTokens) =>
      cfg.buildRequest(effectiveModel, modelPrompt, config.apiKey, baseUrlValue, SYSTEM_PROMPT, budget, opts)

    // Plain (non-streaming) call, transparently retrying on two well-known
    // provider rejections: (a) response_format/JSON mode unsupported (common on
    // some OpenRouter models) — retry without it; (b) the requested max_tokens
    // exceeds the model's output limit (e.g. gpt-4o caps at 16k, so the
    // "complex" budget can overshoot) — retry once with the default budget.
    // Each retry can fire at most once, so this always terminates. Used
    // directly for self-heal and as the streaming fallback.
    const callModelText = async (modelPrompt) => {
      let responseFormat = true
      let budget = maxTokens
      for (;;) {
        try {
          const opts = responseFormat ? undefined : { responseFormat: false }
          const data = await sendRequest(buildReq(modelPrompt, opts, budget), t, { signal })
          return cfg.extract(data)
        } catch (e) {
          if (e && e.isCancelled) throw e
          if (responseFormat && isResponseFormatError(e)) { responseFormat = false; continue }
          if (budget > DEFAULT_MAX_TOKENS && isMaxTokensError(e)) { budget = DEFAULT_MAX_TOKENS; continue }
          throw e
        }
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
            signal,
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
        // A real timeout already waited the full window (don't wait again),
        // and a user cancel must not silently restart the request.
        if (e && (e.isTimeout || e.isCancelled)) throw e
        return await callModelText(modelPrompt)
      }
    }

    try {
      const firstText = await getModelText(prompt, { stream: true })
      // Parse the output; when it isn't valid JSON at all, self-heal once by
      // handing the raw text back to the model ("fix your previous output").
      // Tracked via healedStructure so the run does at most ONE extra model
      // call in total (this heal and the warnings heal below are exclusive).
      let first
      let healedStructure = false
      try {
        first = repairJSON(cleanOutput(firstText), t)
      } catch (parseErr) {
        if (!autoFix || !parseErr.isJsonInvalid) throw parseErr
        setStatus({ state: 'active', key: 'statusFixing', params: {} })
        const fixPrompt = buildStructureRepairPrompt({ rawText: firstText, version: N8N_VERSION, lang: config.lang })
        const fixText = await getModelText(fixPrompt, { stream: false })
        first = repairJSON(cleanOutput(fixText), t)
        healedStructure = true
      }
      // Deterministic envelope fixes (wrapper objects / bare node arrays)
      // before validation, so these never need a model round-trip.
      let parsed = unwrapWorkflow(first.value)
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
      if (autoFix && !healedStructure && resultWarnings.length > 0) {
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
          const healedValue = unwrapWorkflow(healed.value)
          normalizeConnections(healedValue)
          localRepair(healedValue)
          const healedWarnings = validateStructure(healedValue, t)
          if (healedWarnings.length < resultWarnings.length) {
            parsed = healedValue
            repaired = repaired || healed.repaired
            resultWarnings = healedWarnings
          }
        } catch (e) { /* heal is best-effort; keep the original result */ }
      }

      const pretty = JSON.stringify(parsed, null, 2)
      applyResult(parsed, pretty, repaired)
      if (onSuccess) onSuccess(parsed)
    } catch (e) {
      if (e && e.isCancelled) {
        // User-initiated cancel: reset quietly instead of showing an error.
        setStatus({ state: '', key: 'statusCancelled', params: {} })
      } else {
        setErrorMsg(t('errGenerateFailed', { msg: e.message }))
        setStatus({ state: 'error', key: 'statusError', params: {} })
      }
      setStreamingText('')
    } finally {
      abortRef.current = null
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
    // A fresh generation starts a new refine conversation.
    convoRef.current = { description: cleaned, instructions: [] }
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
    const prompt = buildRefinePrompt({
      currentJSON,
      instruction,
      version: N8N_VERSION,
      lang: config.lang,
      context: { description: convoRef.current.description, previousInstructions: convoRef.current.instructions },
    })
    // Capture the workflow as it is *now* so we can report what the refine
    // changed once the model returns the updated version.
    const before = workflowObj
    await runRequest({
      prompt,
      config,
      setBusy: setIsRefining,
      kind: 'refine',
      onSuccess: (parsed) => {
        setRefineInstruction('')
        setLastDiff(diffWorkflows(before, parsed))
        // Only successful refines join the conversation history (a failed run
        // changed nothing, so replaying its instruction would mislead). Keep a
        // bounded tail — the prompt builder clips further anyway.
        convoRef.current.instructions = [...convoRef.current.instructions, instruction].slice(-20)
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
    // Accept common envelopes around pasted JSON too (e.g. an API response
    // wrapping the workflow) before rejecting on shape.
    parsed = unwrapWorkflow(parsed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.nodes)) {
      setErrorMsg(t('errWorkflowJsonShape'))
      return false
    }
    if (onRunStart) onRunStart('load')
    // Pasted JSON is a new baseline: no original description, no prior turns.
    convoRef.current = { description: null, instructions: [] }
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
      if (onRunStart) onRunStart('restore')
      // A restored workflow is a new baseline for refines too.
      convoRef.current = { description: null, instructions: [] }
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
    cancel,
    loadWorkflow,
    restoreHistory,
    clearHistory,
    togglePin,
  }
}
