import { CommentPanel } from './comment-panel'
import { useI18n } from '../i18n'

/**
 * Above-the-fold stage: the copy column and the comment-panel preview.
 *
 * Layout, type scale and spacing are copied from the design reference. The
 * panel is deliberately a static preview; the live widget lives in
 * `LiveDemo` further down so the hero stays above the fold on every viewport.
 */
export function Hero() {
  const { t } = useI18n()

  return (
    <div className="stage">
      <section className="hero">
        <p className="eyebrow">{t.hero.eyebrow}</p>
        <h1>
          {t.hero.titleLine1}
          <br />
          {t.hero.titleLine2}
          <em>{t.hero.titleEm}</em>
        </h1>
        <p className="hero-lede">{t.hero.lede}</p>

        <div className="hero-stats">
          {t.hero.stats.map((stat, index) => (
            <div key={`${stat.value}-${index}`}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="hero-chips">
          {t.hero.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </section>

      <CommentPanel />
    </div>
  )
}
