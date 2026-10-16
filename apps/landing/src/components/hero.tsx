import { useI18n } from '../i18n'

export function Hero({ counts }: { counts: { stars: string; size: string; deps: string } }) {
  const { t } = useI18n()

  return (
    <section className="hero">
      <p className="eyebrow">{t.hero.eyebrow}</p>
      <h1>
        {t.hero.titleLine1}
        <br />
        {t.hero.titleLine2}
      </h1>
      <p className="lede">{t.hero.lede}</p>
      <div className="cta">
        <a className="btn btn-primary" href="#usage">
          {t.hero.getStarted}
        </a>
        <a
          className="btn btn-ghost"
          href="https://github.com/gitalk/gitalk"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.hero.viewSource}
        </a>
      </div>
      <dl className="stats">
        <div>
          <dt>{t.hero.size}</dt>
          <dd>{counts.size}</dd>
        </div>
        <div>
          <dt>{t.hero.runtimeDeps}</dt>
          <dd>{counts.deps}</dd>
        </div>
        <div>
          <dt>{t.hero.stars}</dt>
          <dd>{counts.stars}</dd>
        </div>
      </dl>
    </section>
  )
}
