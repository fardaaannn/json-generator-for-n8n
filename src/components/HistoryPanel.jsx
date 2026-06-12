import { formatRelativeTime, formatAbsoluteTime } from '../lib/timeFormat'

// Collapsible recent-workflows list with restore, pin, and clear actions.
// Renders nothing while the history is empty.
export default function HistoryPanel({ t, uiLang, history, showHistory, setShowHistory, restoreHistory, togglePin, clearHistory }) {
  return (
    <>
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
                  <div key={h.id} className={'history-item' + (h.pinned ? ' pinned' : '')}>
                    <button
                      type="button"
                      className="history-item-main"
                      onClick={() => restoreHistory(h)}
                    >
                      <span className="history-item-name">{h.pinned ? '\u2605 ' : ''}{h.name}</span>
                      <span className="history-item-meta">
                        {t('historyNodes', { n: h.nodeCount })}
                        {h.ts ? (
                          <> &middot; <span title={formatAbsoluteTime(h.ts, uiLang)}>{formatRelativeTime(h.ts, { lang: uiLang, justNow: t('historyJustNow') })}</span></>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={'history-item-pin' + (h.pinned ? ' active' : '')}
                      onClick={() => togglePin(h.id)}
                      aria-pressed={!!h.pinned}
                      aria-label={h.pinned ? t('historyUnpin') : t('historyPin')}
                      title={h.pinned ? t('historyUnpin') : t('historyPin')}
                    >
                      {h.pinned ? '\u2605' : '\u2606'}
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-sm history-clear" onClick={clearHistory}>{t('historyClear')}</button>
              </div>
            )}
          </div>
        )}
    </>
  )
}
