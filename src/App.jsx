import { useState, useEffect, useCallback } from 'react'
import { PROVIDERS } from './lib/providers'
import { EXAMPLES } from './lib/examples'
import { sanitizeInput, buildPrompt, cleanOutput, repairJSON, validateStructure } from './lib/pipeline'
import { getNodeClass } from './lib/getNodeClass'
import Header from './components/Header'
import Hero from './components/Hero'

export default function App() {
  const [description, setDescription] = useState('')
  const [wfName, setWfName] = useState('My Workflow')
  const [n8nVersion, setN8nVersion] = useState('1.x')
  const [complexity, setComplexity] = useState('medium')
  const [lang, setLang] = useState('id')

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
  const [statusState, setStatusState] = useState('')
  const [statusText, setStatusText] = useState('Siap')
  const [errorMsg, setErrorMsg] = useState('')
  const [warnings, setWarnings] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [copyBtnText, setCopyBtnText] = useState('Salin')

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

  const fillExample = useCallback((text) => {
    setDescription(EXAMPLES[text] || text)
    setErrorMsg('')
  }, [])

  const handleGenerate = useCallback(async () => {
    const cleaned = sanitizeInput(description)
    if (!cleaned) {
      setErrorMsg('Masukkan deskripsi workflow dulu ya!')
      return
    }

    const cfg = PROVIDERS[provider]
    const effectiveModel = selectedModel === '__custom__' ? customModel : selectedModel

    if (!effectiveModel) {
      setErrorMsg('Masukkan nama model')
      return
    }
    if (provider !== 'anthropic' && !apiKey) {
      setErrorMsg('Masukkan API key untuk provider ' + cfg.name)
      return
    }
    if (provider === 'custom' && !baseUrl) {
      setErrorMsg('Masukkan Base URL untuk custom provider')
      return
    }

    setIsGenerating(true)
    setErrorMsg('')
    setWarnings([])
    setCurrentJSON('')
    setNodeTags([])
    setStatusState('active')
    setStatusText('Generating workflow...')

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
      const parsed = repairJSON(raw)
      const pretty = JSON.stringify(parsed, null, 2)

      const resultWarnings = validateStructure(parsed)
      setWarnings(resultWarnings)
      setCurrentJSON(pretty)

      if (parsed.nodes && parsed.nodes.length > 0) {
        setNodeTags(parsed.nodes.map(n => ({name: n.name || n.type, type: n.type})))
      }

      const wfNameOut = (parsed.name || 'workflow').replace(/\s+/g, '-').toLowerCase()
      setOutputFilename(wfNameOut + '.json')

      if (resultWarnings.length > 0) {
        setStatusState('done')
        setStatusText('Selesai — ' + (parsed.nodes?.length || 0) + ' nodes (ada peringatan)')
      } else {
        setStatusState('done')
        setStatusText('Selesai — ' + (parsed.nodes?.length || 0) + ' nodes')
      }

    } catch(e) {
      setErrorMsg('Gagal generate: ' + e.message)
      setStatusState('error')
      setStatusText('Error')
    } finally {
      setIsGenerating(false)
    }
  }, [description, wfName, n8nVersion, complexity, lang, provider, selectedModel, customModel, baseUrl, apiKey])

  const handleCopy = useCallback(() => {
    if (!currentJSON) return
    navigator.clipboard.writeText(currentJSON).then(() => {
      setCopyBtnText('\u2713 Tersalin')
      setTimeout(() => setCopyBtnText('Salin'), 2000)
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
            <span className="card-title">Deskripsi workflow</span>
          </div>
          <div className="card-body">
            <div>
              <div className="field-label">Jelaskan workflow yang kamu mau</div>
              <textarea
                id="desc"
                rows="8"
                maxLength={2000}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setErrorMsg('') }}
                placeholder="Contoh: Buat workflow yang menerima webhook, filter data berdasarkan status, lalu kirim notifikasi ke Slack dan simpan ke Google Sheets..."
              />
              <div className="char-count">{description.length} karakter</div>
            </div>

            <div>
              <div className="field-label">Contoh cepat</div>
              <div className="chips">
                {Object.keys(EXAMPLES).map((key) => (
                  <button key={key} className="chip" onClick={() => fillExample(key)}>
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider"></div>

            <div>
              <div className="field-label">AI Provider</div>
              <div className="grid-2">
                <div>
                  <div className="field-label">Provider</div>
                  <select value={provider} onChange={handleProviderChange}>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom / OpenAI-compat</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">Model</div>
                  <select
                    value={selectedModel}
                    onChange={(e) => { setSelectedModel(e.target.value); setErrorMsg('') }}
                    disabled={provider === 'custom'}
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="__custom__">Custom / Other</option>
                  </select>
                </div>
              </div>
              {showCustomModel && (
                <div style={{marginTop:'10px'}}>
                  <div className="field-label">Nama model</div>
                  <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="gpt-4o / llama3 / dll" />
                </div>
              )}
              <div style={{marginTop:'10px'}}>
                <div className="field-label">API Key <span style={{fontWeight:400, opacity:0.7}}>{'(wajib)'}</span></div>
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
                    Ingat API key di browser ini
                  </label>
                </div>
                <div className="security-notice">
                  API key kamu tidak pernah dikirim ke server kami. Request langsung dari browser kamu ke provider AI.
                </div>
                {rememberKey && (
                  <div className="security-notice" style={{color:'#8D6E00'}}>
                    Key disimpan di localStorage browser ini. Jangan gunakan di komputer publik atau shared device.
                  </div>
                )}
              </div>
              {showBaseUrl && (
                <div style={{marginTop:'10px'}}>
                  <div className="field-label">Base URL <span style={{fontWeight:400,opacity:0.7}}>(tanpa /chat/completions)</span></div>
                  <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://ai.sumopod.com/v1" />
                </div>
              )}
              <div style={{marginTop:'10px'}}>
                <div className="connection-badge">
                  <span style={{fontSize:'8px'}}>&#9679;</span> Direct connection &mdash; {providerConfig.name}
                </div>
              </div>
            </div>

            <div className="divider"></div>

            <div>
              <div className="field-label">Opsi</div>
              <div className="grid-2">
                <div>
                  <div className="field-label">Nama workflow</div>
                  <input type="text" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="My Workflow" />
                </div>
                <div>
                  <div className="field-label">Versi n8n</div>
                  <select value={n8nVersion} onChange={(e) => setN8nVersion(e.target.value)}>
                    <option value="1.x">1.x (terbaru)</option>
                    <option value="0.x">0.x (lama)</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">Kompleksitas</div>
                  <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                    <option value="simple">Sederhana</option>
                    <option value="medium">Menengah</option>
                    <option value="complex">Lengkap + error handling</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">Bahasa komentar</div>
                  <select value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="id">Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>
              <span>{isGenerating ? 'Generating...' : 'Generate workflow JSON'}</span>
              <div className="spinner" style={{display: isGenerating ? 'block' : 'none'}}></div>
            </button>

            {errorMsg && (
              <div className="error-msg">
                &#9888; {errorMsg}
              </div>
            )}

            {warnings.length > 0 && !errorMsg && (
              <div className="warning-msg">
                <strong>&#9888; Perhatian:</strong> JSON mungkin perlu perbaikan manual sebelum di-import ke n8n.<br />
                {warnings.map((w, i) => <span key={i}>&bull; {w}<br /></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="card output-card">
          <div className="card-header">
            <span className="card-title">Output JSON</span>
            <div style={{display:'flex', gap:'6px'}}>
              <button className="btn-sm" onClick={handleCopy} disabled={!currentJSON}>{copyBtnText}</button>
              <button className="btn-sm btn-dl" onClick={handleDownload} disabled={!currentJSON}>&darr; Download</button>
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
              <div className="placeholder-text">JSON n8n akan muncul di sini setelah kamu generate workflow</div>
            </div>
          )}
          <div className="status-bar">
            <div className={'status-dot' + (statusState ? ' ' + statusState : '')}></div>
            <span>{statusText}</span>
          </div>
        </div>
      </main>
    </>
  )
}
