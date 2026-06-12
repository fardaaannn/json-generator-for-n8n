import { useState, useEffect, useCallback, useRef } from 'react'
import { PROVIDERS } from './lib/providers'
import { EXAMPLES } from './lib/examples'
import { fetchModels, getModelMeta, formatModelMeta } from './lib/modelCatalog'
import { useLanguage } from './lib/useLanguage'
import { useWorkflowGeneration } from './lib/useWorkflowGeneration'
import { useN8nImport } from './lib/useN8nImport'
import { loadStoredKeys, persistKeys, keyForProvider, setKeyForProvider } from './lib/apiKeyStore'
import { encodeWorkflow, decodeShare, buildShareUrl, readShareParam } from './lib/shareLink'
import Header from './components/Header'
import Hero from './components/Hero'
import References from './components/References'
import Footer from './components/Footer'
import OutputPanel from './components/OutputPanel'
import EditExistingPanel from './components/EditExistingPanel'
import ProviderSettings from './components/ProviderSettings'
import GenerationOptions from './components/GenerationOptions'
import RefineDiff from './components/RefineDiff'
import RefineBar from './components/RefineBar'
import N8nImportPanel from './components/N8nImportPanel'
import HistoryPanel from './components/HistoryPanel'

export default function App() {
  const { t, lang: uiLang } = useLanguage()

  const [description, setDescription] = useState('')
  const [wfName, setWfName] = useState('')
  const [complexity, setComplexity] = useState('medium')
  const [lang, setLang] = useState(uiLang)
  // Follow the UI language until the user explicitly picks a comment language
  // (then their choice wins) — previously this only snapshotted the UI
  // language once at mount, so switching the UI later silently kept the old
  // comment language.
  const langTouchedRef = useRef(false)
  useEffect(() => {
    if (!langTouchedRef.current) setLang(uiLang)
  }, [uiLang])

  const [provider, setProvider] = useState('anthropic')
  const initialModels = PROVIDERS['anthropic'].models
  const [selectedModel, setSelectedModel] = useState(initialModels.length > 0 ? initialModels[0] : '__custom__')
  const [customModel, setCustomModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [rememberBaseUrl, setRememberBaseUrl] = useState(false)

  // Dynamically fetched model catalog for the current provider (falls back to
  // the provider's hardcoded list). See lib/modelCatalog.js.
  const [models, setModels] = useState(initialModels)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState(false)
  // Per-model metadata (context window / pricing) keyed by model id, surfaced
  // in the picker. Populated from the catalog cache after a list resolves.
  const [modelsMeta, setModelsMeta] = useState({})

  // Per-provider API keys (see lib/apiKeyStore.js). `apiKey` is derived for
  // the active provider, with the migrated legacy key as a shared fallback.
  const [apiKeys, setApiKeys] = useState({})
  const [rememberKey, setRememberKey] = useState(false)
  const apiKey = keyForProvider(apiKeys, provider)
  const handleApiKeyInput = useCallback((value) => {
    setApiKeys((prev) => setKeyForProvider(prev, provider, value))
  }, [provider])
  const [showKey, setShowKey] = useState(false)

  // '' | 'ok' | 'fail' — clipboard writes can be rejected (permissions,
  // insecure context), so failure gets surfaced on the button too.
  const [copied, setCopied] = useState('')
  const [shareState, setShareState] = useState('') // '' | 'copied' | 'toolong'
  const [outputView, setOutputView] = useState('json')

  // "Edit an existing workflow": paste raw n8n JSON to load it for preview/
  // refine/import without generating from scratch.
  const [importJson, setImportJson] = useState('')
  const [showImportJson, setShowImportJson] = useState(false)

  // Optional Tier 2: direct import to a user's own n8n instance.
  const n8n = useN8nImport({ t })

  // Workflow generation/refinement, output state, and recent history. When a
  // run starts it clears any lingering n8n import banner.
  const gen = useWorkflowGeneration({ t, onRunStart: n8n.reset })
  const {
    currentJSON, workflowObj, outputFilename,
    status, errorMsg, setErrorMsg, warnings, wasRepaired,
    isGenerating, isRefining,
    streamingText,
    refineInstruction, setRefineInstruction,
    history, showHistory, setShowHistory,
    lastDiff, setLastDiff,
    generate, refine, cancel, restoreHistory, clearHistory,
    loadWorkflow, togglePin,
  } = gen

  useEffect(() => {
    const { keys, remember } = loadStoredKeys()
    if (remember && Object.keys(keys).length > 0) {
      setApiKeys(keys)
      setRememberKey(true)
    }
    const storedBaseUrl = localStorage.getItem('n8n_gen_base_url')
    const storedRememberBaseUrl = localStorage.getItem('n8n_gen_remember_base_url')
    if (storedRememberBaseUrl === 'true' && storedBaseUrl) {
      setBaseUrl(storedBaseUrl)
      setRememberBaseUrl(true)
    }
  }, [])

  // Persist the API key only while "remember" is enabled. Depends on
  // `rememberKey` too so it can't write/skip based on a stale toggle value.
  //
  // SECURITY: this stores the provider API key in localStorage in plaintext.
  // That is an inherent, accepted trade-off for this no-backend tool (the key
  // would otherwise have to be re-entered every visit), but it means any XSS on
  // this origin could read the key. It is opt-in (off by default) and surfaced
  // to the user via the "remember" warning notice. Keep this in mind before
  // adding any third-party scripts or untrusted markup to the page.
  useEffect(() => {
    if (rememberKey && Object.keys(apiKeys).length > 0) {
      persistKeys(apiKeys, true)
    }
  }, [apiKeys, rememberKey])

  // Persist the custom provider's Base URL only while its "remember" toggle is
  // on. Unlike the API key this is not a secret, but it's still opt-in and
  // mirrors the same pattern so the two behave consistently.
  useEffect(() => {
    if (rememberBaseUrl && baseUrl) {
      localStorage.setItem('n8n_gen_base_url', baseUrl)
      localStorage.setItem('n8n_gen_remember_base_url', 'true')
    }
  }, [baseUrl, rememberBaseUrl])

  // Load the live model catalog for the current provider. Debounced on apiKey
  // so typing/pasting a key doesn't fire a request per keystroke. Always keeps
  // the provider's hardcoded list as a fallback.
  useEffect(() => {
    let cancelled = false
    const cfg = PROVIDERS[provider]
    const fallback = cfg.models

    // Custom / OpenAI-compatible: pull the catalog from <baseUrl>/models once a
    // base URL is entered. Without one there's nothing to query, so we fall back
    // to manual model entry (empty dropdown + the "Custom / Other" text field).
    if (provider === 'custom') {
      if (!baseUrl) {
        setModels([]); setModelsLoading(false); setModelsError(false)
        setModelsMeta({})
        // No catalog to pick from → fall back to the manual "Custom / Other" entry.
        setSelectedModel('__custom__')
        return
      }
      setModelsLoading(true); setModelsError(false)
      const customTimer = setTimeout(() => {
        fetchModels('custom', { apiKey, baseUrl })
          .then((list) => {
            if (cancelled) return
            const next = (list && list.length) ? list : []
            setModels(next)
            setModelsMeta(getModelMeta('custom', { apiKey, baseUrl }))
            setSelectedModel((prev) => (prev === '__custom__' || next.includes(prev)) ? prev : '__custom__')
          })
          .catch(() => { if (!cancelled) { setModels([]); setModelsError(true) } })
          .finally(() => { if (!cancelled) setModelsLoading(false) })
      }, 500)
      return () => { cancelled = true; clearTimeout(customTimer) }
    }
    // No live source, or a key is required but not entered yet → built-in list.
    if (!cfg.modelsUrl || (cfg.requiresKeyForModels && !apiKey)) {
      setModels(fallback); setModelsLoading(false); setModelsError(false)
      setModelsMeta({})
      return
    }

    setModelsLoading(true); setModelsError(false)
    const timer = setTimeout(() => {
      fetchModels(provider, { apiKey })
        .then((list) => {
          if (cancelled) return
          const next = (list && list.length) ? list : fallback
          setModels(next)
          setModelsMeta(getModelMeta(provider, { apiKey }))
          setSelectedModel((prev) => (prev === '__custom__' || next.includes(prev)) ? prev : (next[0] || '__custom__'))
        })
        .catch(() => { if (!cancelled) { setModels(fallback); setModelsError(true) } })
        .finally(() => { if (!cancelled) setModelsLoading(false) })
    }, 500)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [provider, apiKey, baseUrl])

  const refreshModels = useCallback(() => {
    const cfg = PROVIDERS[provider]
    // Custom: re-pull from <baseUrl>/models (needs a base URL, key optional).
    if (provider === 'custom') {
      if (!baseUrl) return
      setModelsLoading(true); setModelsError(false)
      fetchModels('custom', { apiKey, baseUrl, force: true })
        .then((list) => {
          const next = (list && list.length) ? list : []
          setModels(next)
          setModelsMeta(getModelMeta('custom', { apiKey, baseUrl }))
          setSelectedModel((prev) => (prev === '__custom__' || next.includes(prev)) ? prev : '__custom__')
        })
        .catch(() => { setModels([]); setModelsError(true) })
        .finally(() => setModelsLoading(false))
      return
    }
    if (!cfg.modelsUrl) return
    if (cfg.requiresKeyForModels && !apiKey) return
    const fallback = cfg.models
    setModelsLoading(true); setModelsError(false)
    fetchModels(provider, { apiKey, force: true })
      .then((list) => {
        const next = (list && list.length) ? list : fallback
        setModels(next)
        setModelsMeta(getModelMeta(provider, { apiKey }))
        setSelectedModel((prev) => (prev === '__custom__' || next.includes(prev)) ? prev : (next[0] || '__custom__'))
      })
      .catch(() => { setModels(fallback); setModelsError(true) })
      .finally(() => setModelsLoading(false))
  }, [provider, apiKey, baseUrl])

  const handleProviderChange = useCallback((e) => {
    const newProvider = e.target.value
    setProvider(newProvider)
    setErrorMsg('')
    setModelsError(false)
    const providerModels = PROVIDERS[newProvider].models
    // Show this provider's built-in list immediately; the effect above then
    // refines it with the live catalog.
    setModels(newProvider === 'custom' ? [] : providerModels)
    setModelsMeta({})
    if (providerModels.length > 0 && newProvider !== 'custom') {
      setSelectedModel(providerModels[0])
      setCustomModel('')
    } else {
      setSelectedModel('__custom__')
    }
  }, [setErrorMsg])

  const handleRememberChange = useCallback((e) => {
    const checked = e.target.checked
    setRememberKey(checked)
    persistKeys(checked ? apiKeys : null, checked)
  }, [apiKeys])

  const handleRememberBaseUrlChange = useCallback((e) => {
    const checked = e.target.checked
    setRememberBaseUrl(checked)
    if (checked) {
      if (baseUrl) {
        localStorage.setItem('n8n_gen_base_url', baseUrl)
      }
      localStorage.setItem('n8n_gen_remember_base_url', 'true')
    } else {
      localStorage.removeItem('n8n_gen_base_url')
      localStorage.setItem('n8n_gen_remember_base_url', 'false')
    }
  }, [baseUrl])

  const examples = EXAMPLES[uiLang] || EXAMPLES.en

  const fillExample = useCallback((key) => {
    setDescription(examples[key] || key)
    setErrorMsg('')
  }, [examples, setErrorMsg])

  const handleGenerate = useCallback(() => {
    generate({ description, wfName, complexity, lang, provider, selectedModel, customModel, baseUrl, apiKey })
  }, [generate, description, wfName, complexity, lang, provider, selectedModel, customModel, baseUrl, apiKey])

  const handleRefine = useCallback(() => {
    refine({ lang, provider, selectedModel, customModel, baseUrl, apiKey })
  }, [refine, lang, provider, selectedModel, customModel, baseUrl, apiKey])

  const handleLoadWorkflow = useCallback(() => {
    // Collapse the panel only on a successful load; on failure the hook sets an
    // error message and we keep the pasted text so the user can fix it.
    if (loadWorkflow(importJson)) setShowImportJson(false)
  }, [loadWorkflow, importJson])

  const handleImportToN8n = useCallback(() => {
    n8n.importWorkflow(workflowObj)
  }, [n8n, workflowObj])

  // Update the workflow previously imported this session instead of creating
  // a duplicate (offered only while an import link exists).
  const handleUpdateInN8n = useCallback(() => {
    n8n.importWorkflow(workflowObj, { mode: 'update' })
  }, [n8n, workflowObj])

  const handleCopy = useCallback(() => {
    if (!currentJSON) return
    navigator.clipboard.writeText(currentJSON).then(() => {
      setCopied('ok')
      setTimeout(() => setCopied(''), 2000)
    }).catch(() => {
      // Without this, a rejected clipboard write was an unhandled rejection
      // and the button silently did nothing.
      setCopied('fail')
      setTimeout(() => setCopied(''), 2500)
    })
  }, [currentJSON])

  const handleDownload = useCallback(() => {
    if (!currentJSON) return
    const blob = new Blob([currentJSON], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = outputFilename; a.click()
    URL.revokeObjectURL(url)
  }, [currentJSON, outputFilename])

  // Build a shareable link carrying the current workflow in the URL hash and
  // copy it to the clipboard. The hash fragment never reaches the server, so
  // (like the API keys) the workflow stays client-side. Very large workflows
  // make impractically long URLs, so warn past a safe threshold and suggest
  // Download instead.
  const SHARE_MAX_URL = 12000
  const handleShare = useCallback(async () => {
    if (!currentJSON) return
    try {
      const token = await encodeWorkflow(currentJSON)
      const url = buildShareUrl(token)
      if (url.length > SHARE_MAX_URL) {
        setShareState('toolong')
        setTimeout(() => setShareState(''), 4000)
        return
      }
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState(''), 2000)
    } catch (e) {
      setShareState('toolong') // surface the generic "use Download" hint on any failure
      setTimeout(() => setShareState(''), 4000)
    }
  }, [currentJSON])

  // On first load, if the URL carries a shared workflow (#w=...), decode it and
  // load it through the same path as a pasted workflow, then strip the hash so
  // a refresh doesn't reload it and the URL stays clean. Guarded so React
  // StrictMode's double-mount can't run it twice.
  const sharedLoadedRef = useRef(false)
  useEffect(() => {
    if (sharedLoadedRef.current) return
    sharedLoadedRef.current = true
    const token = readShareParam()
    if (!token) return
    let cancelled = false
    decodeShare(token).then(({ json, error }) => {
      if (cancelled) return
      if (!json) {
        // Tell the user why the link didn't load instead of failing silently:
        // a link from a newer app version gets its own explanation.
        setErrorMsg(t(error === 'unsupported-version' ? 'errShareVersion' : 'errShareCorrupt'))
        return
      }
      if (loadWorkflow(json)) {
        try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch (e) { /* ignore */ }
      }
    })
    return () => { cancelled = true }
  }, [loadWorkflow, setErrorMsg, t])

  const providerConfig = PROVIDERS[provider]
  const modelOptions = models
  const recommendedSet = new Set(providerConfig.recommended || [])
  // Whether any listed model has metadata (context/pricing) to show — used to
  // decide whether to render the legend explaining the picker's suffixes.
  const hasModelMeta = modelOptions.some((m) => formatModelMeta(modelsMeta[m]))
  const showCustomModel = selectedModel === '__custom__'
  const showBaseUrl = provider === 'custom'
  const needsKeyForModels = provider !== 'custom' && !!providerConfig.modelsUrl && providerConfig.requiresKeyForModels && !apiKey
  const canRefreshModels = provider === 'custom'
    ? !!baseUrl
    : (!!providerConfig.modelsUrl && !(providerConfig.requiresKeyForModels && !apiKey))

  return (
    <>
      <Header />
      <Hero />

      <main className="main">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('descCardTitle')}</span>
          </div>
          <div className="card-body">
            <div>
              <label className="field-label" htmlFor="desc">{t('describeLabel')}</label>
              <textarea
                id="desc"
                rows="8"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setErrorMsg('') }}
                placeholder={t('descPlaceholder')}
              />
              <div className="char-count" aria-hidden="true">{t('charCount', { n: description.length })}</div>
            </div>

            <div>
              <div className="field-label" id="examples-label">{t('quickExamples')}</div>
              <div className="chips" role="group" aria-labelledby="examples-label">
                {Object.keys(examples).map((key) => (
                  <button key={key} type="button" className="chip" onClick={() => fillExample(key)}>
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <EditExistingPanel
              t={t}
              showImportJson={showImportJson}
              setShowImportJson={setShowImportJson}
              importJson={importJson}
              setImportJson={setImportJson}
              setErrorMsg={setErrorMsg}
              handleLoadWorkflow={handleLoadWorkflow}
            />

            <div className="divider"></div>

            <ProviderSettings
              t={t}
              provider={provider}
              handleProviderChange={handleProviderChange}
              providerConfig={providerConfig}
              modelsLoading={modelsLoading}
              modelsError={modelsError}
              canRefreshModels={canRefreshModels}
              refreshModels={refreshModels}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              modelOptions={modelOptions}
              modelsMeta={modelsMeta}
              recommendedSet={recommendedSet}
              hasModelMeta={hasModelMeta}
              needsKeyForModels={needsKeyForModels}
              showCustomModel={showCustomModel}
              customModel={customModel}
              setCustomModel={setCustomModel}
              apiKey={apiKey}
              handleApiKeyInput={handleApiKeyInput}
              showKey={showKey}
              setShowKey={setShowKey}
              rememberKey={rememberKey}
              handleRememberChange={handleRememberChange}
              showBaseUrl={showBaseUrl}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              rememberBaseUrl={rememberBaseUrl}
              handleRememberBaseUrlChange={handleRememberBaseUrlChange}
              setErrorMsg={setErrorMsg}
            />

            <div className="divider"></div>

            <GenerationOptions
              t={t}
              wfName={wfName}
              setWfName={setWfName}
              complexity={complexity}
              setComplexity={setComplexity}
              lang={lang}
              setLang={setLang}
              langTouchedRef={langTouchedRef}
            />

            <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating} aria-busy={isGenerating}>
              <span>{isGenerating ? t('generating') : t('generateBtn')}</span>
              <div className="spinner" style={{display: isGenerating ? 'block' : 'none'}} aria-hidden="true"></div>
            </button>
            {isGenerating && (
              <button type="button" className="btn-sm" onClick={cancel} style={{marginTop:'8px'}}>
                {t('cancelBtn')}
              </button>
            )}

            {errorMsg && (
              <div className="error-msg" role="alert">
                <span aria-hidden="true">&#9888; </span>{errorMsg}
              </div>
            )}

            {(warnings.length > 0 || wasRepaired) && !errorMsg && (
              <div className="warning-msg" role="status">
                <strong><span aria-hidden="true">&#9888; </span>{t('warningTitle')}</strong> {t('warningBody')}<br />
                {wasRepaired && <span>&bull; {t('warnRepaired')}<br /></span>}
                {warnings.map((w, i) => <span key={i}>&bull; {w}<br /></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="card output-card">
          <OutputPanel
            t={t}
            currentJSON={currentJSON}
            workflowObj={workflowObj}
            streamingText={streamingText}
            status={status}
            outputView={outputView}
            setOutputView={setOutputView}
            outputFilename={outputFilename}
            copied={copied}
            handleCopy={handleCopy}
            shareState={shareState}
            handleShare={handleShare}
            handleDownload={handleDownload}
          />

          <RefineDiff t={t} lastDiff={lastDiff} setLastDiff={setLastDiff} />

          <RefineBar
            t={t}
            currentJSON={currentJSON}
            refineInstruction={refineInstruction}
            setRefineInstruction={setRefineInstruction}
            isRefining={isRefining}
            handleRefine={handleRefine}
            cancel={cancel}
          />

          <N8nImportPanel
            t={t}
            n8n={n8n}
            currentJSON={currentJSON}
            handleImportToN8n={handleImportToN8n}
            handleUpdateInN8n={handleUpdateInN8n}
          />

          <HistoryPanel
            t={t}
            uiLang={uiLang}
            history={history}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            restoreHistory={restoreHistory}
            togglePin={togglePin}
            clearHistory={clearHistory}
          />
        </div>
      </main>

      <References />

      <Footer />
    </>
  )
}
