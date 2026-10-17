import { ArrowRight } from 'lucide-react'
import { RichText, useI18n } from '../i18n'

/**
 * Explains the anonymous/authenticated split, which is the single most
 * surprising part of the design: REST can be read anonymously, GraphQL cannot
 * be reached anonymously at all. See docs/tech.md §2.1.
 */
export function BackendExplainer() {
  const { t } = useI18n()
  const { flow } = t

  return (
    <section className="section explainer">
      <div className="section-head">
        <p className="eyebrow">{flow.eyebrow}</p>
        <h2>{flow.title}</h2>
        <p className="section-lede">{flow.lede}</p>
      </div>

      <div className="flow">
        <div className="flow-col">
          <div className="flow-col-head">
            <h3>{flow.anonTitle}</h3>
            <p className="flow-badge flow-badge-free">{flow.anonBadge}</p>
          </div>
          <ul>
            {flow.anonPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div className="flow-arrow" aria-hidden="true">
          <ArrowRight size={18} strokeWidth={1.8} />
        </div>

        <div className="flow-col">
          <div className="flow-col-head">
            <h3>{flow.authTitle}</h3>
            <p className="flow-badge flow-badge-auth">{flow.authBadge}</p>
          </div>
          <ul>
            {flow.authPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="note">
        <RichText text={flow.note} />
      </p>
    </section>
  )
}
