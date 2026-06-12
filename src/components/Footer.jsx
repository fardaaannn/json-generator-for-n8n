import { useLanguage } from '../lib/useLanguage'

const REPO_URL = 'https://github.com/fardaaannn/json-generator-for-n8n'

const SOCIALS = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/aku_fardann',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    name: 'Threads',
    href: 'https://www.threads.com/@aku_fardann',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.5 11.3c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.7-4.5-4.7-1.6 0-3 .7-3.8 2l1.5 1c.6-.9 1.4-1.1 2.3-1.1 1.4 0 2.4.8 2.6 2.3-.6-.1-1.2-.2-1.9-.2-2.4 0-4 1.3-3.9 3.3.1 1.7 1.6 2.8 3.4 2.7 1.5-.1 2.6-.7 3.3-1.9.4 1 1.2 1.6 1.3 1.7l1.2-1.3c-.6-.5-1-1.2-1.1-2 .8-.7 1.3-1.7 1.4-3 0-.3 0-.5-.1-.7zm-4.6 4.6c-.9.1-1.6-.4-1.7-1.1 0-.7.6-1.3 1.9-1.3.5 0 1 .1 1.5.2-.2 1.4-.9 2.1-1.7 2.2z" />
        <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-18.2c-4.5 0-8.2 3.7-8.2 8.2s3.7 8.2 8.2 8.2 8.2-3.7 8.2-8.2S16.5 3.8 12 3.8z" />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    href: 'https://github.com/fardaaannn',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 2.5-.34c.85 0 1.71.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.34 4.78-4.57 5.04.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/share/14gn9EkrTYS/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
      </svg>
    ),
  },
]

export default function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-message">{t('footerMessage')}</p>

        <nav className="footer-socials" aria-label={t('footerFollow')}>
          {SOCIALS.map((s) => (
            <a
              key={s.name}
              className="footer-social"
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
              title={s.name}
            >
              {s.icon}
            </a>
          ))}
        </nav>

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
