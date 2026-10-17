import { GitalkDemo } from './gitalk-demo'
import { HeroStats, StatCards, useStats } from './stats'
import { useState } from 'react'
import { useI18n } from '../i18n'

/**
 * Above-the-fold stage: the copy column and the real widget.
 *
 * The panel on the right is `<GitalkDemo mode={mode} proxy={proxy} />`, i.e. the same core that ships to
 * npm mounted in this page — not a static preview. Its height is fixed by the
 * shell below, so a slow or empty thread can never push the hero open; the
 * widget's own list scrolls inside the frame. The six metrics reappear as a
 * heavier card strip immediately after the stage.
 */
const ENDPOINTS = [
  { id: 'cf', label: 'Cloudflare', proxy: 'https://gitalk-proxy.aispin-abf.workers.dev' },
  { id: 'cloudbase', label: 'CloudBase', proxy: 'https://gitalk.xsin.work' }
] as const

export function Hero() {
  const { t } = useI18n()
  const [mode, setMode] = useState<'default' | 'inline'>('default')
  const [proxy, setProxy] = useState<string>(ENDPOINTS[0].proxy)
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
        </section>

        {/* The only wrapper around the widget: positioning and size, nothing
            else. The component ships its own panel shape. */}
        <div className="demo">
          <GitalkDemo mode={mode} proxy={proxy} />
        <div className="demo-controls">
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
          <div className="hero-endpoints" role="group" aria-label={t.hero.endpointLabel}>
            {ENDPOINTS.map((endpoint) => (
              <button
                key={endpoint.id}
                type="button"
                className={proxy === endpoint.proxy ? "is-active" : ""}
                aria-pressed={proxy === endpoint.proxy}
                onClick={() => setProxy(endpoint.proxy)}
              >
                {endpoint.label}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      <StatCards items={stats} />
    </>
  )
}
