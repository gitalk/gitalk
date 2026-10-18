import { useI18n } from '../i18n'

/**
 * The five steps between "I want comments" and "they work".
 *
 * Four of them are things only a person can do — creating the GitHub App,
 * pasting the values, setting the callback URL once the deploy has printed an
 * address, dropping the component in — and one is a command. They are numbered
 * because order matters: step three can only run once step two exists.
 */
export function GetStarted() {
  const { t } = useI18n()
  const steps = t.getStarted.steps

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
          href="https://github.com/gitalk/gitalk/blob/main/packages/gitalk-deploy/README.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.getStarted.more}
        </a>
      </p>
    </section>
  )
}
