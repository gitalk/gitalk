import { useI18n } from '../i18n'

/**
 * The five steps between "I want comments" and "they work", kept deliberately
 * short: this is an overview, not the manual.
 *
 * The manual lives in exactly one place — `packages/gitalk-deploy/README.md`
 * (Chinese: `README-CN.md`). Everything here has to agree with it, and
 * `scripts/check-docs.mjs` fails the build if it stops doing so. The `more`
 * link at the bottom is the one place that points at the full write-up.
 */
const README_BASE = 'https://github.com/gitalk/gitalk/blob/main/packages/gitalk-deploy'

export function GetStarted() {
  const { t, lang } = useI18n()
  const steps = t.getStarted.steps
  const chinese = lang === 'zh' || lang === 'zh-TW'

  return (
    <section id="get-started" className="section">
      <div className="section-head">
        <p className="eyebrow">{t.getStarted.eyebrow}</p>
        <h2>{t.getStarted.title}</h2>
        <p className="section-lede">{t.getStarted.lede}</p>
      </div>

      <ol className="steps">
        {steps.map((step, index) => (
          <li className="step" key={step.title}>
            <span className="step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="step-body">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.code ? <pre className="step-code"><code>{step.code}</code></pre> : null}
            </div>
          </li>
        ))}
      </ol>

      <aside className="step-note">
        <h3>{t.getStarted.domainTitle}</h3>
        <p>{t.getStarted.domainBody}</p>
      </aside>

      <p className="step-more">
        <a
          href={`${README_BASE}/${chinese ? 'README-CN.md' : 'README.md'}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.getStarted.more}
        </a>
      </p>
    </section>
  )
}
