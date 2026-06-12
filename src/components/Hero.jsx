import { useLanguage } from '../lib/useLanguage'

export default function Hero() {
  const { t } = useLanguage()
  return (
    <section className="hero">
      <div className="badge">
        <span className="badge-dot"></span>
        {t('heroBadge')}
      </div>
      <h1>{t('heroTitle1')}<br />{t('heroTitle2')}</h1>
      <p>{t('heroDesc')}</p>
    </section>
  );
}
