// Collapsible "import to your n8n" panel: instance URL + API key, the
// import/update buttons (update appears while a session import link exists),
// and the result/error banners. `n8n` is the useN8nImport hook bundle.
export default function N8nImportPanel({ t, n8n, currentJSON, handleImportToN8n, handleUpdateInN8n }) {
  return (
    <div className="n8n-import">
          <button
            type="button"
            className="n8n-import-toggle"
            onClick={() => n8n.setShowN8nImport((v) => !v)}
            aria-expanded={n8n.showN8nImport}
            aria-controls="n8n-import-body"
          >
            <span>{t('n8nImportTitle')}</span>
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
              {n8n.linkedId ? (
                <div className="n8n-import-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleUpdateInN8n}
                    disabled={!currentJSON || n8n.n8nImporting}
                    aria-busy={n8n.n8nImporting}
                  >
                    <span>{n8n.n8nImporting ? t('n8nImporting') : t('n8nUpdateBtn')}</span>
                    <div className="spinner" style={{display: n8n.n8nImporting ? 'block' : 'none'}} aria-hidden="true"></div>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleImportToN8n}
                    disabled={!currentJSON || n8n.n8nImporting}
                  >
                    <span>{t('n8nImportNewBtn')}</span>
                  </button>
                </div>
              ) : (
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
              )}
              {n8n.n8nError && (
                <div className="error-msg" role="alert">
                  <span aria-hidden="true">&#9888; </span>{n8n.n8nError}
                </div>
              )}
              {n8n.n8nResult && (
                <div className="success-msg" role="status">
                  <span aria-hidden="true">&#10003; </span>{n8n.n8nResult.updated ? t('n8nUpdateSuccess') : t('n8nImportSuccess')}
                  {n8n.n8nResult.url && (
                    <> <a href={n8n.n8nResult.url} target="_blank" rel="noopener noreferrer">{t('n8nOpenWorkflow')}</a></>
                  )}
                </div>
              )}
              <p className="security-notice">{t('n8nImportHint')}</p>
            </div>
          )}
        </div>
  )
}
