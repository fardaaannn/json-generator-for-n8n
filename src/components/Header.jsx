import { useLanguage } from '../lib/i18n'

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  return (
    <header className="header">
      <div className="header-brand">
        <div className="logo-mark">
          <svg viewBox="0 0 16 16"><path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM11.5 9v6M8.5 12h6"/></svg>
        </div>
        <span className="site-name">n8n Generator</span>
      </div>
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
    </header>
  );
}
