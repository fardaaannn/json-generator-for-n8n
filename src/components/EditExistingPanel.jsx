// "Edit an existing workflow": collapsible paste-JSON box that loads raw n8n
// JSON for preview/refine/import without generating from scratch.
export default function EditExistingPanel({ t, showImportJson, setShowImportJson, importJson, setImportJson, setErrorMsg, handleLoadWorkflow }) {
  return (
    <div className="n8n-import">
          <button
            type="button"
            className="n8n-import-toggle"
            onClick={() => setShowImportJson((v) => !v)}
            aria-expanded={showImportJson}
            aria-controls="import-json-body"
          >
            <span>{t('editExistingTitle')}</span>
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
  )
}
