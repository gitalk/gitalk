import { GitalkDemo } from './gitalk-demo'
import { HeroStats, StatCards, useStats } from './stats'
import { useState } from 'react'
import { useI18n } from '../i18n'

/**
 * Above-the-fold stage: the copy column and the real widget.
 *
 * The panel on the right is `<GitalkDemo mode={mode} />`, i.e. the same core that ships to
 * npm mounted in this page — not a static preview. Its height is fixed by the
 * shell below, so a slow or empty thread can never push the hero open; the
 * widget's own list scrolls inside the frame. The six metrics reappear as a
 * heavier card strip immediately after the stage.
 */
export function Hero() {
  const { t } = useI18n()
  const [mode, setMode] = useState<'default' | 'inline'>('default')
  const stats = useStats()

  return (
    <>
      <div className="stage" id="demo">
        <section className="hero">
          <p className="eyebrow">{t.hero.eyebrow}</p>
          <h1>
            {t.hero.titleLine1}
            <br />
            {t.hero.titleLine2}
            <em>{t.hero.titleEm}</em>
          </h1>
          <p className="hero-lede">{t.hero.lede}</p>

          <HeroStats items={stats} />

          {/* Try the widget as a panel or as part of the page. This switches
              its own `mode` option rather than restyling it from here. */}
          <div className="hero-mode" role="group" aria-label={t.hero.modeLabel}>
            {(["default", "inline"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={mode === value ? "is-active" : ""}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {value === "default" ? t.hero.modeDefault : t.hero.modeInline}
              </button>
            ))}
          </div>
        </section>

        {/* The only wrapper around the widget: positioning and size, nothing
            else. The component ships its own panel shape. */}
        <div className="demo">
          <GitalkDemo mode={mode} />
        </div>
      </div>

      <StatCards items={stats} />
    </>
  )
}
