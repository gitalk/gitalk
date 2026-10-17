import { useI18n } from '../i18n'

export function Features() {
  const { t } = useI18n()

  return (
    <section id="features" className="section">
      <div className="section-head">
        <p className="eyebrow">{t.features.eyebrow}</p>
        <h2>{t.features.title}</h2>
        <p className="section-lede">{t.features.lede}</p>
      </div>

      <div className="feature-grid">
        {t.features.items.map((feature) => (
          <article key={feature.title} className="feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
