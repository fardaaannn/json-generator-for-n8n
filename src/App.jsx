import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './lib/providers'
import { EXAMPLES } from './lib/examples'
import { fetchModels } from './lib/modelCatalog'
import { getNodeClass } from './lib/getNodeClass'
import { useLanguage } from './lib/i18n'
import { useWorkflowGeneration } from './lib/useWorkflowGeneration'
import { useN8nImport } from './lib/useN8nImport'
import Header from './components/Header'
import Hero from './components/Hero'
import References from './components/References'
import Footer from './components/Footer'
import WorkflowPreview from './components/WorkflowPreview'

// Third-party resource where users can obtain a free provider API key/token.
// External service, outside this project's control (see disclaimer wording).
const FREE_KEY_URL = 'https://www.tokengratis.id/'

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

  const [copied, setCopied] = useState(false)
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
    currentJSON, workflowObj, nodeTags, outputFilename,
    status, errorMsg, setErrorMsg, warnings, wasRepaired,
    isGenerating, isRefining,
    refineInstruction, setRefineInstruction,
    history, showHistory, setShowHistory,
    lastDiff, setLastDiff,
    generate, refine, restoreHistory, clearHistory,
    loadWorkflow,
  } = gen

  useEffect(() => {
    const storedKey = localStorage.getItem('n8n_gen_api_key')
    const storedRemember = localStorage.getItem('n8n_gen_remember')
    if (storedRemember === 'true' && storedKey) {
      setApiKey(storedKey)
      setRememberKey(true)
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
    if (rememberKey && apiKey) {
      localStorage.setItem('n8n_gen_api_key', apiKey)
      localStorage.setItem('n8n_gen_remember', 'true')
    }
  }, [apiKey, rememberKey])

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
  const recommendedSet = new Set(providerConfig.recommended || [])
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

            <div className="n8n-import">
              <button
                type="button"
                className="n8n-import-toggle"
                onClick={() => setShowImportJson((v) => !v)}
                aria-expanded={showImportJson}
                aria-controls="import-json-body"
              >
                <span>{t('editExistingTitle')} <span className="optional-tag">{t('optionalTag')}</span></span>
                <span className="n8n-import-chevron" aria-hidden="true">{showImportJson ? '\u2212' : '+'}</span>
              </button>
              {showImportJson && (
                <div className="n8n-import-body" id="import-json-body">
                  <p className="security-notice">{t('editExistingDesc')}</p>
                  <div>
                    <label className="field-label" htmlFor="importJson">{t('pasteWorkflowLabel')}</label>
                    <textarea
                      id="importJson"
                      rows="6"
                      value={importJson}
                      onChange={(e) => { setImportJson(e.target.value); setErrorMsg('') }}
                      placeholder={t('pasteWorkflowPlaceholder')}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleLoadWorkflow}
                    disabled={!importJson.trim()}
                  >
                    <span>{t('loadWorkflowBtn')}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="divider"></div>

            <fieldset className="field-group">
              <legend className="field-label">{t('aiProvider')}</legend>
              <div className="grid-2">
                <div>
                  <label className="field-label field-label-row" htmlFor="provider">
                    <span>{t('provider')}</span>
                  </label>
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
                    disabled={provider === 'custom' && modelOptions.length === 0}
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{recommendedSet.has(m) ? '\u2605 ' + m : m}</option>
                    ))}
                    <option value="__custom__">{t('customOther')}</option>
                  </select>
                  <p className="model-note">{t('modelQualityHint')}</p>
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
                <p className="apikey-help">
                  {t('apiKeyFreeHelp')}{' '}
                  <a href={FREE_KEY_URL} target="_blank" rel="noopener noreferrer">
                    tokengratis.id <span aria-hidden="true">&rarr;</span>
                  </a>
                </p>
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

          {lastDiff && (
            <div className="refine-diff" role="status" aria-live="polite">
              <div className="refine-diff-head">
                <span className="refine-diff-title">{t('diffTitle')}</span>
                <button
                  type="button"
                  className="refine-diff-dismiss"
                  onClick={() => setLastDiff(null)}
                  aria-label={t('diffDismiss')}
                >
                  &times;
                </button>
              </div>
              {lastDiff.hasChanges ? (
                <ul className="refine-diff-list">
                  {lastDiff.addedNodes.length > 0 && (
                    <li className="d-added">{t('diffAddedNodes', { items: lastDiff.addedNodes.join(', ') })}</li>
                  )}
                  {lastDiff.removedNodes.length > 0 && (
                    <li className="d-removed">{t('diffRemovedNodes', { items: lastDiff.removedNodes.join(', ') })}</li>
                  )}
                  {lastDiff.modifiedNodes.length > 0 && (
                    <li className="d-modified">{t('diffModifiedNodes', { items: lastDiff.modifiedNodes.join(', ') })}</li>
                  )}
                  {lastDiff.addedConnections.length > 0 && (
                    <li className="d-added">{t('diffAddedConns', { items: lastDiff.addedConnections.map((c) => c.from + ' \u2192 ' + c.to).join(', ') })}</li>
                  )}
                  {lastDiff.removedConnections.length > 0 && (
                    <li className="d-removed">{t('diffRemovedConns', { items: lastDiff.removedConnections.map((c) => c.from + ' \u2192 ' + c.to).join(', ') })}</li>
                  )}
                </ul>
              ) : (
                <p className="refine-diff-none">{t('diffNoChanges')}</p>
              )}
            </div>
          )}

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
              onClick={() => n8n.setShowN8nImport((v) => !v)}
              aria-expanded={n8n.showN8nImport}
              aria-controls="n8n-import-body"
            >
              <span>{t('n8nImportTitle')} <span className="optional-tag">{t('optionalTag')}</span></span>
              <span className="n8n-import-chevron" aria-hidden="true">{n8n.showN8nImport ? '\u2212' : '+'}</span>
            </button>
            {n8n.showN8nImport && (
              <div className="n8n-import-body" id="n8n-import-body">
                <p className="security-notice">{t('n8nImportDesc')}</p>
                <div>
                  <label className="field-label" htmlFor="n8nUrl">{t('n8nUrlLabel')} <span style={{fontWeight:400, opacity:0.7}}>{t('n8nUrlHint')}</span></label>
                  <input
                    id="n8nUrl"
                    type="url"
                    value={n8n.n8nUrl}
                    onChange={(e) => { n8n.setN8nUrl(e.target.value); n8n.setN8nError(''); }}
                    placeholder="https://your-n8n.example.com"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="n8nApiKey">{t('n8nKeyLabel')}</label>
                  <div className="password-wrap">
                    <input
                      id="n8nApiKey"
                      type={n8n.showN8nKey ? 'text' : 'password'}
                      value={n8n.n8nApiKey}
                      onChange={(e) => { n8n.setN8nApiKey(e.target.value); n8n.setN8nError(''); }}
                      placeholder="n8n_api_..."
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => n8n.setShowN8nKey(!n8n.showN8nKey)}
                      aria-label={n8n.showN8nKey ? t('hideKey') : t('showKey')}
                      aria-pressed={n8n.showN8nKey}
                    >
                      {n8n.showN8nKey ? '\u25C9' : '\u25C7'}
                    </button>
                  </div>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={n8n.rememberN8n} onChange={n8n.handleRememberN8nChange} />
                  {t('n8nRemember')}
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleImportToN8n}
                  disabled={!currentJSON || n8n.n8nImporting}
                  aria-busy={n8n.n8nImporting}
                >
                  <span>{n8n.n8nImporting ? t('n8nImporting') : t('n8nImportBtn')}</span>
                  <div className="spinner" style={{display: n8n.n8nImporting ? 'block' : 'none'}} aria-hidden="true"></div>
                </button>
                {n8n.n8nError && (
                  <div className="error-msg" role="alert">
                    <span aria-hidden="true">&#9888; </span>{n8n.n8nError}
                  </div>
                )}
                {n8n.n8nResult && (
                  <div className="success-msg" role="status">
                    <span aria-hidden="true">&#10003; </span>{t('n8nImportSuccess')}
                    {n8n.n8nResult.url && (
                      <> <a href={n8n.n8nResult.url} target="_blank" rel="noopener noreferrer">{t('n8nOpenWorkflow')}</a></>
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
