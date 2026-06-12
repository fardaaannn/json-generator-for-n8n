import { formatModelMeta } from '../lib/modelCatalog'

// Third-party resource where users can obtain a free provider API key/token.
// External service, outside this project's control (see disclaimer wording).
const FREE_KEY_URL = 'https://www.tokengratis.id/'

// The "AI provider" fieldset: provider/model pickers (with live catalog
// refresh), API key entry + remember toggle + security notices, and the
// custom Base URL field. All state lives in App; this is presentational.
export default function ProviderSettings({ t, provider, handleProviderChange, providerConfig, modelsLoading, modelsError, canRefreshModels, refreshModels, selectedModel, setSelectedModel, modelOptions, modelsMeta, recommendedSet, hasModelMeta, needsKeyForModels, showCustomModel, customModel, setCustomModel, apiKey, handleApiKeyInput, showKey, setShowKey, rememberKey, handleRememberChange, showBaseUrl, baseUrl, setBaseUrl, rememberBaseUrl, handleRememberBaseUrlChange, setErrorMsg }) {
  return (
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
                {modelOptions.map((m) => {
                  const star = recommendedSet.has(m) ? '\u2605 ' : ''
                  const meta = formatModelMeta(modelsMeta[m])
                  return (
                    <option key={m} value={m}>{star + m + (meta ? '  \u2014  ' + meta : '')}</option>
                  )
                })}
                <option value="__custom__">{t('customOther')}</option>
              </select>
              <p className="model-note">{t('modelQualityHint')}</p>
              {hasModelMeta && <p className="model-note">{t('modelMetaLegend')}</p>}
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
            <label className="field-label" htmlFor="apiKey">{t('apiKey')} <span style={{fontWeight:400, opacity:0.7}}>({providerConfig.name}) {t('required')}</span></label>
            <div className="password-wrap">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyInput(e.target.value)}
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
              </a>{' '}
              ({t('apiKeyFreeDisclaim')})
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
              <div style={{marginTop:'6px'}}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={rememberBaseUrl} onChange={handleRememberBaseUrlChange} />
                  {t('rememberBaseUrl')}
                </label>
              </div>
            </div>
          )}
          <div style={{marginTop:'10px'}}>
            <div className="connection-badge">
              <span style={{fontSize:'8px'}} aria-hidden="true">&#9679;</span> {t('directConnection')} &mdash; {providerConfig.name}
            </div>
          </div></fieldset>
  )
}
