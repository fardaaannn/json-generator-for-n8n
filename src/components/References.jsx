import { useLanguage } from '../lib/useLanguage'
import { REFERENCES } from '../lib/references'

export default function References() {
  const { t, lang } = useLanguage()

  return (
    <section className="references" aria-labelledby="ref-title">
      <div className="references-inner">
        <div className="references-head">
          <h2 id="ref-title" className="references-title">{t('refTitle')}</h2>
          <p className="references-subtitle">{t('refSubtitle')}</p>
        </div>

        <div className="references-grid">
          {REFERENCES.map((r) => (
            <a
              key={r.id}
              className="reference-card"
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${r.name} \u2014 ${r.author} (${t('refOpen')})`}
            >
              <div className="reference-card-top">
                <span className="reference-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 2.5-.34c.85 0 1.71.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.34 4.78-4.57 5.04.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
                  </svg>
                </span>
                <span className="reference-open" aria-hidden="true">{t('refOpen')} &rarr;</span>
              </div>
              <div className="reference-name">{r.name}</div>
              <div className="reference-author">{r.author}</div>
              <p className="reference-desc">{lang === 'id' ? r.descId : r.descEn}</p>
            </a>
          ))}
        </div>

        <p className="references-disclaimer">{t('refDisclaimer')}</p>
      </div>
    </section>
  )
}
