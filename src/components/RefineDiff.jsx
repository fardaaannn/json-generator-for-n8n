// Dismissible summary of what the last refine changed (nodes/connections
// added, removed, modified). Renders nothing until a diff exists.
export default function RefineDiff({ t, lastDiff, setLastDiff }) {
  return (
    <>
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
    </>
  )
}
