import { useEffect, useRef } from 'react'
import { Textural } from '@aifire/textural'
import { GitalkDemo } from './gitalk-demo'
import { useI18n } from '../i18n'

/**
 * Hero background recipe.
 *
 * `hero` mode is textural's giant-watermark layout: a pale brand-tinted wash
 * with one blurred word, which gives the panel depth without competing with
 * the copy. The parameters stay deliberately soft — low intensity, a slow
 * flow, a small DPR cap — because this canvas is above the fold and animates
 * forever. `Textural` itself turns the animation off when
 * `prefers-reduced-motion: reduce` is set, so there is no extra branch here.
 */
const BACKGROUND = {
  text: 'Gitalk',
  mode: 'tile' as const,
  hue: 226, // #1E4FFF's hue, so the wash stays on-brand
  blur: 0.3,
  intensity: 0.9,
  scale: 0.72,
  grain: 0.35,
  speed: 0.35,
  seed: 7,
  dprMax: 1.5
}

export function Hero({ dark }: { dark: boolean }) {
  const { t } = useI18n()
  const backgroundHost = useRef<HTMLDivElement | null>(null)
  const background = useRef<Textural | null>(null)

  useEffect(() => {
    const host = backgroundHost.current
    if (!host) return
    const instance = new Textural(host, {
      ...BACKGROUND,
      theme: dark ? 'dark' : 'light'
    })
    background.current = instance
    return () => {
      instance.destroy()
      background.current = null
    }
    // Mount once; the theme is synced by the effect below so toggling the
    // landing page theme does not rebuild the WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    background.current?.update({ theme: dark ? 'dark' : 'light' })
  }, [dark])

  return (
    <section className="hero">
      {/* Textural inserts its canvas as this layer's first child. The layer is
          aria-hidden, pointer-events: none, and sits under .hero-inner. */}
      <div ref={backgroundHost} className="hero-bg" aria-hidden="true" />

      <div className="hero-inner">
        <div className="hero-copy">
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
        </div>

        <div className="hero-showcase" id="demo">
          <div className="macbook">
            <div className="macbook-screen">
              <span className="macbook-camera" aria-hidden="true" />
              <div className="macbook-display">
                <GitalkDemo />
              </div>
            </div>
            <div className="macbook-base" aria-hidden="true">
              <span className="macbook-notch" />
            </div>
          </div>
          <p className="hero-demo-note">
            <span className="demo-live-dot" aria-hidden="true" />
            {t.demo.liveNote}
          </p>
        </div>
      </div>
    </section>
  )
}
