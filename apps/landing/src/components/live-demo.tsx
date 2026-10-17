import { GitalkDemo } from './gitalk-demo'
import { useI18n } from '../i18n'

/**
 * Mounts the real widget inside the new visual shell.
 *
 * The hero panel is only a static preview of the design; this section is the
 * part that actually talks to GitHub. Keeping the two apart means the hero can
 * match the reference without waiting on network requests, while the live
 * widget stays a first-class part of the page.
 */
export function LiveDemo() {
  const { t } = useI18n()

  return (
    <section id="demo" className="section live-section">
      <div className="section-head">
        <p className="eyebrow">{t.live.eyebrow}</p>
        <h2>{t.live.title}</h2>
        <p className="section-lede">{t.live.lede}</p>
      </div>

      <div className="demo-frame">
        <GitalkDemo />
      </div>
    </section>
  )
}
