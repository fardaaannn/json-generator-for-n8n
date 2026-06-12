import WorkflowPreview from './WorkflowPreview'

// Output card top half: copy/share/download actions, filename + JSON/preview
// view toggle, the output itself (code, live stream, or placeholder), and the
// status bar. All state lives in App; this is presentational.
export default function OutputPanel({ t, currentJSON, workflowObj, streamingText, status, outputView, setOutputView, outputFilename, copied, handleCopy, shareState, handleShare, handleDownload, shareSecrets, shareSecretsSummary, handleShareAnyway, handleShareCancel, riskNames }) {
  return (
    <>
    <div className="card-header">
          <span className="card-title">{t('outputTitle')}</span>
          <div style={{display:'flex', gap:'6px'}}>
            <button type="button" className="btn-sm" onClick={handleCopy} disabled={!currentJSON}>{copied === 'fail' ? t('copyFailed') : copied === 'ok' ? t('copied') : t('copy')}</button>
            <button type="button" className="btn-sm" onClick={handleShare} disabled={!currentJSON} title={t('shareBtn')}>
              <span aria-hidden="true">&#128279; </span>{shareState === 'copied' ? t('shareCopied') : t('shareBtn')}
            </button>
            <button type="button" className="btn-sm btn-dl" onClick={handleDownload} disabled={!currentJSON}><span aria-hidden="true">&darr; </span>{t('download')}</button>
          </div>
        </div>
        {shareState === 'toolong' && (
          <div className="warning-msg" role="status" style={{margin:'0 0 8px'}}>
            <span aria-hidden="true">&#9888; </span>{t('shareTooLong')}
          </div>
        )}
        {shareSecrets && shareSecrets.length > 0 && (
          <div className="warning-msg" role="alert" style={{margin:'0 0 8px'}}>
            <strong><span aria-hidden="true">&#9888; </span>{t('shareSecretsTitle')}</strong>{' '}
            {t('shareSecretsBody', { findings: shareSecretsSummary })}
            <div style={{display:'flex', gap:'6px', marginTop:'8px'}}>
              <button type="button" className="btn-sm" onClick={handleShareCancel}>{t('shareSecretsCancel')}</button>
              <button type="button" className="btn-sm" onClick={handleShareAnyway}>{t('shareSecretsAnyway')}</button>
            </div>
          </div>
        )}
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

        {currentJSON ? (
          outputView === 'preview' ? (
            <WorkflowPreview workflow={workflowObj} t={t} riskNames={riskNames} />
          ) : (
            <pre className="output-code" tabIndex={0} aria-label={t('outputTitle')}>{currentJSON}</pre>
          )
        ) : streamingText ? (
          <pre className="output-code output-streaming" tabIndex={0} aria-label={t('outputTitle')} aria-live="polite">{streamingText}</pre>
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
    </>
  )
}
