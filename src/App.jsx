import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './lib/providers'
import { EXAMPLES } from './lib/examples'
import { sanitizeInput, buildPrompt, cleanOutput, repairJSON, validateStructure } from './lib/pipeline'
import { getNodeClass } from './lib/getNodeClass'
import { useLanguage } from './lib/i18n'
import Header from './components/Header'
import Hero from './components/Hero'

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
  const [nodeTags, setNodeTags] = useState([])
  const [outputFilename, setOutputFilename] = useState('workflow.json')
  const [status, setStatus] = useState({ state: '', key: 'statusReady', params: {} })
  const [errorMsg, setErrorMsg] = useState('')
  const [warnings, setWarnings] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const storedKey = localStorage.getItem('n8n_gen_api_key')
    const storedRemember = localStorage.getItem('n8n_gen_remember')
    if (storedRemember === 'true' && storedKey) {
      setApiKey(storedKey)
      setRememberKey(true)
    }
  }, [])

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
    setCurrentJSON('')
    setNodeTags([])
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

      const res = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: req.body
      })

      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status
        try {
          const errData = await res.json()
          errMsg = errData.error?.message || errData.message || errData.detail || errMsg
        } catch(e) {
          try { errMsg = (await res.text()).slice(0, 200) || errMsg } catch(e2) {}
        }
        throw new Error(errMsg + ' (' + res.status + ')')
      }

      const data = await res.json()
      let raw = cfg.extract(data)
      raw = cleanOutput(raw)
      const parsed = repairJSON(raw, t)
      const pretty = JSON.stringify(parsed, null, 2)

      const resultWarnings = validateStructure(parsed, t)
      setWarnings(resultWarnings)
      setCurrentJSON(pretty)

      if (parsed.nodes && parsed.nodes.length > 0) {
        setNodeTags(parsed.nodes.map(n => ({name: n.name || n.type, type: n.type})))
      }

      const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
      setOutputFilename(wfNameOut + '.json')

      const nodeCount = parsed.nodes?.length || 0
      setStatus({
        state: 'done',
        key: resultWarnings.length > 0 ? 'statusDoneWarn' : 'statusDone',
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
              <div className="field-label">{t('describeLabel')}</div>
              <textarea
                id="desc"
                rows="8"
                maxLength={2000}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setErrorMsg('') }}
                placeholder={t('descPlaceholder')}
              />
              <div className="char-count">{t('charCount', { n: description.length })}</div>
            </div>

            <div>
              <div className="field-label">{t('quickExamples')}</div>
              <div className="chips">
                {Object.keys(examples).map((key) => (
                  <button key={key} className="chip" onClick={() => fillExample(key)}>
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider"></div>

            <div>
              <div className="field-label">{t('aiProvider')}</div>
              <div className="grid-2">
                <div>
                  <div className="field-label">{t('provider')}</div>
                  <select value={provider} onChange={handleProviderChange}>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom / OpenAI-compat</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">{t('model')}</div>
                  <select
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
                  <div className="field-label">{t('modelName')}</div>
                  <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder={t('modelNamePlaceholder')} />
                </div>
              )}
              <div style={{marginTop:'10px'}}>
                <div className="field-label">{t('apiKey')} <span style={{fontWeight:400, opacity:0.7}}>{t('required')}</span></div>
                <div className="password-wrap">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button className="eye-btn" onClick={() => setShowKey(!showKey)} tabIndex={-1}>
                    {showKey ? '\u25C9' : '\u25C7'}
                  </button>
                </div>
                <div style={{marginTop:'6px'}}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={rememberKey} onChange={handleRememberChange} />
                    {t('rememberKey')}
                  </label>
                </div>
                <div className="security-notice">
                  {t('securityDirect')}
                </div>
                {rememberKey && (
                  <div className="security-notice" style={{color:'#8D6E00'}}>
                    {t('securityRemember')}
                  </div>
                )}
              </div>
              {showBaseUrl && (
                <div style={{marginTop:'10px'}}>
                  <div className="field-label">{t('baseUrl')} <span style={{fontWeight:400,opacity:0.7}}>{t('baseUrlHint')}</span></div>
                  <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://ai.sumopod.com/v1" />
                </div>
              )}
              <div style={{marginTop:'10px'}}>
                <div className="connection-badge">
                  <span style={{fontSize:'8px'}}>&#9679;</span> {t('directConnection')} &mdash; {providerConfig.name}
                </div>
              </div>
            </div>

            <div className="divider"></div>

            <div>
              <div className="field-label">{t('options')}</div>
              <div className="grid-2">
                <div>
                  <div className="field-label">{t('wfName')}</div>
                  <input type="text" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="My Workflow" />
                </div>
                <div>
                  <div className="field-label">{t('n8nVersion')}</div>
                  <select value={n8nVersion} onChange={(e) => setN8nVersion(e.target.value)}>
                    <option value="1.x">{t('versionLatest')}</option>
                    <option value="0.x">{t('versionLegacy')}</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">{t('complexity')}</div>
                  <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                    <option value="simple">{t('complexitySimple')}</option>
                    <option value="medium">{t('complexityMedium')}</option>
                    <option value="complex">{t('complexityComplex')}</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">{t('commentLang')}</div>
                  <select value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="id">{t('optIndonesian')}</option>
                    <option value="en">{t('optEnglish')}</option>
                  </select>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>
              <span>{isGenerating ? t('generating') : t('generateBtn')}</span>
              <div className="spinner" style={{display: isGenerating ? 'block' : 'none'}}></div>
            </button>

            {errorMsg && (
              <div className="error-msg">
                &#9888; {errorMsg}
              </div>
            )}

            {warnings.length > 0 && !errorMsg && (
              <div className="warning-msg">
                <strong>&#9888; {t('warningTitle')}</strong> {t('warningBody')}<br />
                {warnings.map((w, i) => <span key={i}>&bull; {w}<br /></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="card output-card">
          <div className="card-header">
            <span className="card-title">{t('outputTitle')}</span>
            <div style={{display:'flex', gap:'6px'}}>
              <button className="btn-sm" onClick={handleCopy} disabled={!currentJSON}>{copied ? t('copied') : t('copy')}</button>
              <button className="btn-sm btn-dl" onClick={handleDownload} disabled={!currentJSON}>&darr; {t('download')}</button>
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
            <pre className="output-code">{currentJSON}</pre>
          ) : (
            <div className="output-placeholder">
              <div className="placeholder-icon">{'{ }'}</div>
              <div className="placeholder-text">{t('outputPlaceholder')}</div>
            </div>
          )}
          <div className="status-bar">
            <div className={'status-dot' + (status.state ? ' ' + status.state : '')}></div>
            <span>{t(status.key, status.params)}</span>
          </div>
        </div>
      </main>
    </>
  )
}
