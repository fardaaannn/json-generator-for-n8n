import { useLanguage } from '../lib/useLanguage'
import { useTheme } from '../lib/useTheme'

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="header">
      <a
        href={import.meta.env.BASE_URL}
        className="header-brand"
        aria-label={t('brandHome')}
        onClick={(e) => {
          // This is a single page, so the "home" link just smooth-scrolls back
          // to the top instead of doing a full reload that would discard the
          // user's generated workflow.
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <div className="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM11.5 9v6M8.5 12h6"/></svg>
        </div>
        <span className="site-name">n8n Generator</span>
      </a>
      <div className="header-actions">
        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label={t('toggleTheme')}
          title={t('toggleTheme')}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div className="lang-switch" role="group" aria-label={t('switchLang')}>
          <button
            className={'lang-btn' + (lang === 'id' ? ' active' : '')}
            onClick={() => setLang('id')}
            aria-pressed={lang === 'id'}
          >ID</button>
          <button
            className={'lang-btn' + (lang === 'en' ? ' active' : '')}
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
          >EN</button>
        </div>
      </div>
    </header>
  );
}
