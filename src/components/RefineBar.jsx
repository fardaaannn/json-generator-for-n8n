// Follow-up instruction input + refine/cancel buttons. Only visible once a
// workflow is loaded.
export default function RefineBar({ t, currentJSON, refineInstruction, setRefineInstruction, isRefining, handleRefine, cancel }) {
  return (
    <>
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
              {isRefining && (
                <button type="button" className="btn-sm" onClick={cancel}>
                  {t('cancelBtn')}
                </button>
              )}
            </div>
          </div>
        )}
    </>
  )
}
