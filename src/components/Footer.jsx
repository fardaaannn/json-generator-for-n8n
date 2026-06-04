import { useLanguage } from '../lib/i18n'

const REPO_URL = 'https://github.com/fardaaannn/json-generator-for-n8n'

export default function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-name">n8n Generator</span>
          <span className="footer-tagline">{t('footerTagline')}</span>
        </div>
        <p className="footer-privacy">{t('footerPrivacy')}</p>
        <div className="footer-meta">
          <a className="footer-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            {t('footerSource')}
          </a>
          <span className="footer-sep" aria-hidden="true">&bull;</span>
          <span className="footer-disclaimer">{t('footerDisclaimer')}</span>
          <span className="footer-sep" aria-hidden="true">&bull;</span>
          <span>&copy; {year}</span>
        </div>
      </div>
    </footer>
  )
}
