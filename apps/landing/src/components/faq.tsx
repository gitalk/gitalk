import { RichText, useI18n } from '../i18n'

/**
 * The questions that come up before anyone deploys anything: whether the CDN
 * build is enough, whether the proxy is mandatory, where the data ends up, and
 * how to get off v1.
 *
 * A plain <dl>, not a set of <details>: seven answers of two or three lines
 * read better as one continuous list than as seven things to click open, and a
 * page that hides its objections behind a disclosure is a page people stop
 * scanning. It also keeps Ctrl+F and text selection working over the whole
 * section. The first answer carries the CDN snippet; that snippet is the same
 * in every locale, so it comes from snippets.ts instead of the dictionaries.
 */
export function Faq() {
  const { t } = useI18n()

  return (
    <section id="faq" className="section">
      <div className="section-head">
        <p className="eyebrow">{t.faq.eyebrow}</p>
        <h2>{t.faq.title}</h2>
      </div>

      <dl className="faq">
        {t.faq.items.map((item) => (
          <div className="faq-item" key={item.q}>
            <dt className="faq-q">{item.q}</dt>
            <dd className="faq-a">
              {item.code ? (
                <pre className="faq-code" dir="ltr">
                  <code>{item.code}</code>
                </pre>
              ) : null}
              <p>
                <RichText text={item.a} />
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
