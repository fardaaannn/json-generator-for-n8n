import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './lib/providers'
import { EXAMPLES } from './lib/examples'
import { sanitizeInput, buildPrompt, cleanOutput, repairJSON, validateStructure, sendRequest, importToN8n, SYSTEM_PROMPT, buildRefinePrompt } from './lib/pipeline'
import { fetchModels } from './lib/modelCatalog'
import { getNodeClass } from './lib/getNodeClass'
import { useLanguage } from './lib/i18n'
import Header from './components/Header'
import Hero from './components/Hero'
import References from './components/References'
import Footer from './components/Footer'
import WorkflowPreview from './components/WorkflowPreview'

// n8n major version targeted by generated workflows. The user-facing version
// dropdown was removed (0.x is long obsolete); workflows now always target the
// current 1.x line. Kept as a single constant so prompts stay consistent.
const N8N_VERSION = '1.x'

export default function App() {
  const { t, lang: uiLang } = useLanguage()

  const [description, setDescription] = useState('')
  const [wfName, setWfName] = useState('')
  const [complexity, setComplexity] = useState('medium')
  const [lang, setLang] = useState(uiLang)

  const [provider, setProvider] = useState('anthropic')
  const initialModels = PROVIDERS['anthropic'].models
  const [selectedModel, setSelectedModel] = useState(initialModels.length > 0 ? initialModels[0] : '__custom__')
  const [customModel, setCustomModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  // Dynamically fetched model catalog for the current provider (falls back to
  // the provider's hardcoded list). See lib/modelCatalog.js.
  const [models, setModels] = useState(initialModels)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [rememberKey, setRememberKey] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const [currentJSON, setCurrentJSON] = useState('')
  const [workflowObj, setWorkflowObj] = useState(null)
  const [nodeTags, setNodeTags] = useState([])
  const [outputFilename, setOutputFilename] = useState('workflow.json')
  const [status, setStatus] = useState({ state: '', key: 'statusReady', params: {} })
  const [errorMsg, setErrorMsg] = useState('')
  const [warnings, setWarnings] = useState([])
  const [wasRepaired, setWasRepaired] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [outputView, setOutputView] = useState('json')
  const [refineInstruction, setRefineInstruction] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Optional Tier 2: direct import to a user's own n8n instance
  const [showN8nImport, setShowN8nImport] = useState(false)
  const [n8nUrl, setN8nUrl] = useState('')
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [rememberN8n, setRememberN8n] = useState(false)
  const [showN8nKey, setShowN8nKey] = useState(false)
  const [n8nImporting, setN8nImporting] = useState(false)
  const [n8nResult, setN8nResult] = useState(null)
  const [n8nError, setN8nError] = useState('')

  useEffect(() => {
    const storedKey = localStorage.getItem('n8n_gen_api_key')
    const storedRemember = localStorage.getItem('n8n_gen_remember')
    if (storedRemember === 'true' && storedKey) {
      setApiKey(storedKey)
      setRememberKey(true)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('n8n_gen_history')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 10))
      }
    } catch (e) { /* ignore corrupted history */ }
  }, [])

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

  useEffect(() => {
    if (rememberN8n) {
      localStorage.setItem('n8n_gen_n8n_url', n8nUrl)
      localStorage.setItem('n8n_gen_n8n_key', n8nApiKey)
      localStorage.setItem('n8n_gen_n8n_remember', 'true')
    }
  }, [n8nUrl, n8nApiKey])

  useEffect(() => {
    if (rememberKey && apiKey) {
      localStorage.setItem('n8n_gen_api_key', apiKey)
      localStorage.setItem('n8n_gen_remember', 'true')
    }
  }, [apiKey])

  // Load the live model catalog for the current provider. Debounced on apiKey
  // so typing/pasting a key doesn't fire a request per keystroke. Always keeps
  // the provider's hardcoded list as a fallback.
  useEffect(() => {
    let cancelled = false
    const cfg = PROVIDERS[provider]
    const fallback = cfg.models

    // Custom / OpenAI-compatible: the user types the model name manually.
    if (provider === 'custom') {
      setModelsLoading(false); setModelsError(false)
      return
    }
    // No live source, or a key is required but not entered yet → built-in list.
    if (!cfg.modelsUrl || (cfg.requiresKeyForModels && !apiKey)) {
      setModels(fallback); setModelsLoading(false); setModelsError(false)
      return
    }

    setModelsLoading(true); setModelsError(false)
    const timer = setTimeout(() => {
      fetchModels(provider, { apiKey })
        .then((list) => {
          if (cancelled) return
          const next = (list && list.length) ? list : fallback
          setModels(next)
          setSelectedModel((prev) => (prev === '__custom__' || next.includes(prev)) ? prev : (next[0] || '__custom__'))
        })
        .catch(() => { if (!cancelled) { setModels(fallback); setModelsError(true) } })
        .finally(() => { if (!cancelled) setModelsLoading(false) })
    }, 500)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [provider, apiKey])

  const refreshModels = useCallback(() => {
    const cfg = PROVIDERS[provider]
    if (provider === 'custom' || !cfg.modelsUrl) return
    if (cfg.requiresKeyForModels && !apiKey) return
    const fallback = cfg.models
    setModelsLoading(true); setModelsError(false)
    fetchModels(provider, { apiKey, force: true })
      .then((list) => {
        const next = (list && list.length) ? list : fallback
        setModels(next)
        setSelectedModel((prev) => (prev === '__custom__' || next.includes(prev)) ? prev : (next[0] || '__custom__'))
      })
      .catch(() => { setModels(fallback); setModelsError(true) })
      .finally(() => setModelsLoading(false))
  }, [provider, apiKey])

  const handleProviderChange = useCallback((e) => {
    const newProvider = e.target.value
    setProvider(newProvider)
    setErrorMsg('')
    setModelsError(false)
    const providerModels = PROVIDERS[newProvider].models
    // Show this provider's built-in list immediately; the effect above then
    // refines it with the live catalog.
    setModels(newProvider === 'custom' ? [] : providerModels)
    if (providerModels.length > 0 && newProvider !== 'custom') {
      setSelectedModel(providerModels[0])
      setCustomModel('')
    } else {
      setSelectedModel('__custom__')
    }
  }, [])

  const handleRememberChange = useCallback((e) => {
    const checked = e.target.checked
    setRememberKey(checked)
    if (checked) {
      if (apiKey) {
        localStorage.setItem('n8n_gen_api_key', apiKey)
      }
      localStorage.setItem('n8n_gen_remember', 'true')
    } else {
      localStorage.removeItem('n8n_gen_api_key')
      localStorage.setItem('n8n_gen_remember', 'false')
    }
  }, [apiKey])

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

  const handleImportToN8n = useCallback(async () => {
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
  }, [workflowObj, n8nUrl, n8nApiKey, t])

  const examples = EXAMPLES[uiLang] || EXAMPLES.en

  const fillExample = useCallback((key) => {
    setDescription(examples[key] || key)
    setErrorMsg('')
  }, [examples])

  const pushHistory = useCallback((parsed, pretty) => {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: (parsed && typeof parsed.name === 'string' && parsed.name) ? parsed.name : 'workflow',
      nodeCount: Array.isArray(parsed?.nodes) ? parsed.nodes.length : 0,
      ts: Date.now(),
      json: pretty,
    }
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 10)
      try { localStorage.setItem('n8n_gen_history', JSON.stringify(next)) } catch (e) { /* quota */ }
      return next
    })
  }, [])

  const restoreHistory = useCallback((entry) => {
    try {
      const parsed = JSON.parse(entry.json)
      setCurrentJSON(entry.json)
      setWorkflowObj(parsed)
      setNodeTags(Array.isArray(parsed.nodes) ? parsed.nodes.map(n => ({ name: n.name || n.type, type: n.type })) : [])
      const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
      setOutputFilename(wfNameOut + '.json')
      setWarnings([])
      setWasRepaired(false)
      setN8nResult(null)
      setN8nError('')
      setErrorMsg('')
      setStatus({ state: 'done', key: 'statusDone', params: { n: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0 } })
    } catch (e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
    }
  }, [t])

  const clearHistory = useCallback(() => {
    setHistory([])
    try { localStorage.removeItem('n8n_gen_history') } catch (e) { /* ignore */ }
  }, [])

  const handleGenerate = useCallback(async () => {
    const cleaned = sanitizeInput(description)
    if (!cleaned) {
      setErrorMsg(t('errEnterDesc'))
      return
    }

    const cfg = PROVIDERS[provider]
    const effectiveModel = selectedModel === '__custom__' ? customModel : selectedModel

    if (!effectiveModel) {
      setErrorMsg(t('errEnterModel'))
      return
    }
    if (!apiKey) {
      setErrorMsg(t('errEnterApiKey', { provider: cfg.name }))
      return
    }
    if (provider === 'custom' && !baseUrl) {
      setErrorMsg(t('errEnterBaseUrl'))
      return
    }

    setIsGenerating(true)
    setErrorMsg('')
    setWarnings([])
    setWasRepaired(false)
    setCurrentJSON('')
    setWorkflowObj(null)
    setNodeTags([])
    setN8nResult(null)
    setN8nError('')
    setStatus({ state: 'active', key: 'statusGenerating', params: {} })

    try {
      const prompt = buildPrompt({
        description: cleaned,
        name: wfName || 'My Workflow',
        version: N8N_VERSION,
        complexity,
        lang
      })

      const baseUrlValue = provider === 'custom' ? baseUrl : undefined
      const req = cfg.buildRequest(effectiveModel, prompt, apiKey, baseUrlValue, SYSTEM_PROMPT)

      const data = await sendRequest(req, t)
      let raw = cfg.extract(data)
      raw = cleanOutput(raw)
      const { value: parsed, repaired } = repairJSON(raw, t)
      const pretty = JSON.stringify(parsed, null, 2)

      setWasRepaired(repaired)
      const resultWarnings = validateStructure(parsed, t)
      setWarnings(resultWarnings)
      setCurrentJSON(pretty)
      setWorkflowObj(parsed)

      if (parsed.nodes && parsed.nodes.length > 0) {
        setNodeTags(parsed.nodes.map(n => ({name: n.name || n.type, type: n.type})))
      }

      const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
      setOutputFilename(wfNameOut + '.json')

      const nodeCount = parsed.nodes?.length || 0
      setStatus({
        state: 'done',
        key: (resultWarnings.length > 0 || repaired) ? 'statusDoneWarn' : 'statusDone',
        params: { n: nodeCount }
      })
      pushHistory(parsed, pretty)

    } catch(e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
      setStatus({ state: 'error', key: 'statusError', params: {} })
    } finally {
      setIsGenerating(false)
    }
  }, [description, wfName, complexity, lang, provider, selectedModel, customModel, baseUrl, apiKey, t, pushHistory])

  const handleRefine = useCallback(async () => {
    const instruction = sanitizeInput(refineInstruction)
    if (!instruction) {
      setErrorMsg(t('errEnterRefine'))
      return
    }
    if (!workflowObj || !currentJSON) {
      setErrorMsg(t('errN8nNoWorkflow'))
      return
    }

    const cfg = PROVIDERS[provider]
    const effectiveModel = selectedModel === '__custom__' ? customModel : selectedModel
    if (!effectiveModel) { setErrorMsg(t('errEnterModel')); return }
    if (!apiKey) { setErrorMsg(t('errEnterApiKey', { provider: cfg.name })); return }
    if (provider === 'custom' && !baseUrl) { setErrorMsg(t('errEnterBaseUrl')); return }

    setIsRefining(true)
    setErrorMsg('')
    setWarnings([])
    setWasRepaired(false)
    setN8nResult(null)
    setN8nError('')
    setStatus({ state: 'active', key: 'statusGenerating', params: {} })

    try {
      const prompt = buildRefinePrompt({ currentJSON, instruction, version: N8N_VERSION, lang })
      const baseUrlValue = provider === 'custom' ? baseUrl : undefined
      const req = cfg.buildRequest(effectiveModel, prompt, apiKey, baseUrlValue, SYSTEM_PROMPT)

      const data = await sendRequest(req, t)
      let raw = cfg.extract(data)
      raw = cleanOutput(raw)
      const { value: parsed, repaired } = repairJSON(raw, t)
      const pretty = JSON.stringify(parsed, null, 2)

      setWasRepaired(repaired)
      const resultWarnings = validateStructure(parsed, t)
      setWarnings(resultWarnings)
      setCurrentJSON(pretty)
      setWorkflowObj(parsed)

      if (parsed.nodes && parsed.nodes.length > 0) {
        setNodeTags(parsed.nodes.map(n => ({ name: n.name || n.type, type: n.type })))
      } else {
        setNodeTags([])
      }

      const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
      setOutputFilename(wfNameOut + '.json')

      const nodeCount = parsed.nodes?.length || 0
      setStatus({
        state: 'done',
        key: (resultWarnings.length > 0 || repaired) ? 'statusDoneWarn' : 'statusDone',
        params: { n: nodeCount }
      })
      pushHistory(parsed, pretty)
      setRefineInstruction('')
    } catch (e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
      setStatus({ state: 'error', key: 'statusError', params: {} })
    } finally {
      setIsRefining(false)
    }
  }, [refineInstruction, currentJSON, workflowObj, lang, provider, selectedModel, customModel, baseUrl, apiKey, t, pushHistory])

  const handleCopy = useCallback(() => {
    if (!currentJSON) return
    navigator.clipboard.writeText(currentJSON).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  const providerConfig = PROVIDERS[provider]
  const modelOptions = models
  const showCustomModel = provider === 'custom' || selectedModel === '__custom__'
  const showBaseUrl = provider === 'custom'
  const needsKeyForModels = provider !== 'custom' && !!providerConfig.modelsUrl && providerConfig.requiresKeyForModels && !apiKey
  const canRefreshModels = provider !== 'custom' && !!providerConfig.modelsUrl && !(providerConfig.requiresKeyForModels && !apiKey)

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
                maxLength={2000}
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

            <div className="divider"></div>

            <fieldset className="field-group">
              <legend className="field-label">{t('aiProvider')}</legend>
              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="provider">{t('provider')}</label>
                  <select id="provider" value={provider} onChange={handleProviderChange}>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom / OpenAI-compat</option>
                  </select>
                </div>
                <div>
                  <label className="field-label field-label-row" htmlFor="model">
                    <span>
                      {t('model')}
                      {modelsLoading && <span className="model-hint"> · {t('modelsLoading')}</span>}
                    </span>
                    {canRefreshModels && (
                      <button
                        type="button"
                        className="model-refresh"
                        onClick={refreshModels}
                        disabled={modelsLoading}
                        aria-label={t('modelsRefresh')}
                        title={t('modelsRefresh')}
                      >
                        &#8635;
                      </button>
                    )}
                  </label>
                  <select
                    id="model"
                    value={selectedModel}
                    onChange={(e) => { setSelectedModel(e.target.value); setErrorMsg('') }}
                    disabled={provider === 'custom'}
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="__custom__">{t('customOther')}</option>
                  </select>
                  {needsKeyForModels && <p className="model-note">{t('modelsEnterKey')}</p>}
                  {modelsError && <p className="model-note">{t('modelsFetchError')}</p>}
                </div>
              </div>
              {showCustomModel && (
                <div style={{marginTop:'10px'}}>
                  <label className="field-label" htmlFor="customModel">{t('modelName')}</label>
                  <input id="customModel" type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder={t('modelNamePlaceholder')} />
                </div>
              )}
              <div style={{marginTop:'10px'}}>
                <label className="field-label" htmlFor="apiKey">{t('apiKey')} <span style={{fontWeight:400, opacity:0.7}}>{t('required')}</span></label>
                <div className="password-wrap">
                  <input
                    id="apiKey"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    aria-required="true"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowKey(!showKey)}
                    aria-label={showKey ? t('hideKey') : t('showKey')}
                    aria-pressed={showKey}
                  >
                    {showKey ? '\u25C9' : '\u25C7'}
                  </button>
                </div>
                <div style={{marginTop:'6px'}}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={rememberKey} onChange={handleRememberChange} />
                    {t('rememberKey')}
                  </label>
                </div>
                <p className="security-notice">
                  {t('securityDirect')}
                </p>
                {rememberKey && (
                  <p className="security-notice warn">
                    {t('securityRemember')}
                  </p>
                )}
              </div>
              {showBaseUrl && (
                <div style={{marginTop:'10px'}}>
                  <label className="field-label" htmlFor="baseUrl">{t('baseUrl')} <span style={{fontWeight:400,opacity:0.7}}>{t('baseUrlHint')}</span></label>
                  <input id="baseUrl" type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://ai.sumopod.com/v1" />
                </div>
              )}
              <div style={{marginTop:'10px'}}>
                <div className="connection-badge">
                  <span style={{fontSize:'8px'}} aria-hidden="true">&#9679;</span> {t('directConnection')} &mdash; {providerConfig.name}
                </div>
              </div>
            </fieldset>

            <div className="divider"></div>

            <fieldset className="field-group">
              <legend className="field-label">{t('options')}</legend>
              <div className="grid-2">
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label" htmlFor="wfName">{t('wfName')}</label>
                  <input id="wfName" type="text" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="My Workflow" />
                </div>
                <div>
                  <label className="field-label" htmlFor="complexity">{t('complexity')}</label>
                  <select id="complexity" value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                    <option value="simple">{t('complexitySimple')}</option>
                    <option value="medium">{t('complexityMedium')}</option>
                    <option value="complex">{t('complexityComplex')}</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="commentLang">{t('commentLang')}</label>
                  <select id="commentLang" value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="id">{t('optIndonesian')}</option>
                    <option value="en">{t('optEnglish')}</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating} aria-busy={isGenerating}>
              <span>{isGenerating ? t('generating') : t('generateBtn')}</span>
              <div className="spinner" style={{display: isGenerating ? 'block' : 'none'}} aria-hidden="true"></div>
            </button>

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
          <div className="card-header">
            <span className="card-title">{t('outputTitle')}</span>
            <div style={{display:'flex', gap:'6px'}}>
              <button type="button" className="btn-sm" onClick={handleCopy} disabled={!currentJSON}>{copied ? t('copied') : t('copy')}</button>
              <button type="button" className="btn-sm btn-dl" onClick={handleDownload} disabled={!currentJSON}><span aria-hidden="true">&darr; </span>{t('download')}</button>
            </div>
          </div>
          <div className="output-toolbar">
            <span className="output-filename">{outputFilename}</span>
            {currentJSON && (
              <div className="output-view-toggle" role="group" aria-label={t('viewToggle')}>
                <button
                  type="button"
                  className={'view-btn' + (outputView === 'json' ? ' active' : '')}
                  onClick={() => setOutputView('json')}
                  aria-pressed={outputView === 'json'}
                >
                  {t('viewJson')}
                </button>
                <button
                  type="button"
                  className={'view-btn' + (outputView === 'preview' ? ' active' : '')}
                  onClick={() => setOutputView('preview')}
                  aria-pressed={outputView === 'preview'}
                >
                  {t('viewPreview')}
                </button>
              </div>
            )}
          </div>
          {nodeTags.length > 0 && (
            <div className="node-tags">
              {nodeTags.map((n, i) => (
                <span key={i} className={'node-tag ' + getNodeClass(n.type)}>{n.name}</span>
              ))}
            </div>
          )}
          {currentJSON ? (
            outputView === 'preview' ? (
              <WorkflowPreview workflow={workflowObj} t={t} />
            ) : (
              <pre className="output-code" tabIndex={0} aria-label={t('outputTitle')}>{currentJSON}</pre>
            )
          ) : (
            <div className="output-placeholder">
              <div className="placeholder-icon" aria-hidden="true">{'{ }'}</div>
              <div className="placeholder-text">{t('outputPlaceholder')}</div>
            </div>
          )}
          <div className="status-bar" role="status" aria-live="polite">
            <div className={'status-dot' + (status.state ? ' ' + status.state : '')} aria-hidden="true"></div>
            <span>{t(status.key, status.params)}</span>
          </div>

          {currentJSON && (
            <div className="refine">
              <label className="field-label" htmlFor="refine">{t('refineLabel')}</label>
              <div className="refine-row">
                <input
                  id="refine"
                  type="text"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isRefining && refineInstruction.trim()) handleRefine() }}
                  placeholder={t('refinePlaceholder')}
                  disabled={isRefining}
                />
                <button
                  type="button"
                  className="btn-sm refine-btn"
                  onClick={handleRefine}
                  disabled={isRefining || !refineInstruction.trim()}
                  aria-busy={isRefining}
                >
                  {isRefining ? t('refining') : t('refineBtn')}
                </button>
              </div>
            </div>
          )}

          <div className="n8n-import">
            <button
              type="button"
              className="n8n-import-toggle"
              onClick={() => setShowN8nImport((v) => !v)}
              aria-expanded={showN8nImport}
              aria-controls="n8n-import-body"
            >
              <span>{t('n8nImportTitle')} <span className="optional-tag">{t('optionalTag')}</span></span>
              <span className="n8n-import-chevron" aria-hidden="true">{showN8nImport ? '\u2212' : '+'}</span>
            </button>
            {showN8nImport && (
              <div className="n8n-import-body" id="n8n-import-body">
                <p className="security-notice">{t('n8nImportDesc')}</p>
                <div>
                  <label className="field-label" htmlFor="n8nUrl">{t('n8nUrlLabel')} <span style={{fontWeight:400, opacity:0.7}}>{t('n8nUrlHint')}</span></label>
                  <input
                    id="n8nUrl"
                    type="url"
                    value={n8nUrl}
                    onChange={(e) => { setN8nUrl(e.target.value); setN8nError(''); }}
                    placeholder="https://your-n8n.example.com"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="n8nApiKey">{t('n8nKeyLabel')}</label>
                  <div className="password-wrap">
                    <input
                      id="n8nApiKey"
                      type={showN8nKey ? 'text' : 'password'}
                      value={n8nApiKey}
                      onChange={(e) => { setN8nApiKey(e.target.value); setN8nError(''); }}
                      placeholder="n8n_api_..."
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowN8nKey(!showN8nKey)}
                      aria-label={showN8nKey ? t('hideKey') : t('showKey')}
                      aria-pressed={showN8nKey}
                    >
                      {showN8nKey ? '\u25C9' : '\u25C7'}
                    </button>
                  </div>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={rememberN8n} onChange={handleRememberN8nChange} />
                  {t('n8nRemember')}
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleImportToN8n}
                  disabled={!currentJSON || n8nImporting}
                  aria-busy={n8nImporting}
                >
                  <span>{n8nImporting ? t('n8nImporting') : t('n8nImportBtn')}</span>
                  <div className="spinner" style={{display: n8nImporting ? 'block' : 'none'}} aria-hidden="true"></div>
                </button>
                {n8nError && (
                  <div className="error-msg" role="alert">
                    <span aria-hidden="true">&#9888; </span>{n8nError}
                  </div>
                )}
                {n8nResult && (
                  <div className="success-msg" role="status">
                    <span aria-hidden="true">&#10003; </span>{t('n8nImportSuccess')}
                    {n8nResult.url && (
                      <> <a href={n8nResult.url} target="_blank" rel="noopener noreferrer">{t('n8nOpenWorkflow')}</a></>
                    )}
                  </div>
                )}
                <p className="security-notice">{t('n8nImportHint')}</p>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="history">
              <button
                type="button"
                className="n8n-import-toggle"
                onClick={() => setShowHistory((v) => !v)}
                aria-expanded={showHistory}
                aria-controls="history-body"
              >
                <span>{t('historyTitle')} <span className="optional-tag">{history.length}</span></span>
                <span className="n8n-import-chevron" aria-hidden="true">{showHistory ? '\u2212' : '+'}</span>
              </button>
              {showHistory && (
                <div className="history-body" id="history-body">
                  {history.map((h) => (
                    <button key={h.id} type="button" className="history-item" onClick={() => restoreHistory(h)}>
                      <span className="history-item-name">{h.name}</span>
                      <span className="history-item-meta">{t('historyNodes', { n: h.nodeCount })}</span>
                    </button>
                  ))}
                  <button type="button" className="btn-sm history-clear" onClick={clearHistory}>{t('historyClear')}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <References />

      <Footer />
    </>
  )
}
