import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './lib/providers'
import { EXAMPLES } from './lib/examples'
import { sanitizeInput, buildPrompt, cleanOutput, repairJSON, validateStructure, sendRequest, importToN8n } from './lib/pipeline'
import { getNodeClass } from './lib/getNodeClass'
import { useLanguage } from './lib/i18n'
import Header from './components/Header'
import Hero from './components/Hero'
import References from './components/References'
import Footer from './components/Footer'

export default function App() {
  const { t, lang: uiLang } = useLanguage()

  const [description, setDescription] = useState('')
  const [wfName, setWfName] = useState('My Workflow')
  const [n8nVersion, setN8nVersion] = useState('1.x')
  const [complexity, setComplexity] = useState('medium')
  const [lang, setLang] = useState(uiLang)

  const [provider, setProvider] = useState('anthropic')
  const initialModels = PROVIDERS['anthropic'].models
  const [selectedModel, setSelectedModel] = useState(initialModels.length > 0 ? initialModels[0] : '__custom__')
  const [customModel, setCustomModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

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

  const handleProviderChange = useCallback((e) => {
    const newProvider = e.target.value
    setProvider(newProvider)
    setErrorMsg('')
    const models = PROVIDERS[newProvider].models
    if (models.length > 0) {
      setSelectedModel(models[0])
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
        version: n8nVersion,
        complexity,
        lang
      })

      const baseUrlValue = provider === 'custom' ? baseUrl : undefined
      const req = cfg.buildRequest(effectiveModel, prompt, apiKey, baseUrlValue)

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

    } catch(e) {
      setErrorMsg(t('errGenerateFailed', { msg: e.message }))
      setStatus({ state: 'error', key: 'statusError', params: {} })
    } finally {
      setIsGenerating(false)
    }
  }, [description, wfName, n8nVersion, complexity, lang, provider, selectedModel, customModel, baseUrl, apiKey, t])

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
  const modelOptions = providerConfig.models
  const showCustomModel = provider === 'custom' || selectedModel === '__custom__'
  const showBaseUrl = provider === 'custom'

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
                  <label className="field-label" htmlFor="model">{t('model')}</label>
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
                <div>
                  <label className="field-label" htmlFor="wfName">{t('wfName')}</label>
                  <input id="wfName" type="text" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="My Workflow" />
                </div>
                <div>
                  <label className="field-label" htmlFor="n8nVersion">{t('n8nVersion')}</label>
                  <select id="n8nVersion" value={n8nVersion} onChange={(e) => setN8nVersion(e.target.value)}>
                    <option value="1.x">{t('versionLatest')}</option>
                    <option value="0.x">{t('versionLegacy')}</option>
                  </select>
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
          </div>
          {nodeTags.length > 0 && (
            <div className="node-tags">
              {nodeTags.map((n, i) => (
                <span key={i} className={'node-tag ' + getNodeClass(n.type)}>{n.name}</span>
              ))}
            </div>
          )}
          {currentJSON ? (
            <pre className="output-code" tabIndex={0} aria-label={t('outputTitle')}>{currentJSON}</pre>
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
        </div>
      </main>

      <References />

      <Footer />
    </>
  )
}
