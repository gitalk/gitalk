import { useState } from 'react'
import { RichText, useI18n } from '../i18n'

/** Snippet ids are language-independent; labels, hints and code are not. */
const TAB_IDS = ['vanilla', 'react', 'vue'] as const
type TabId = (typeof TAB_IDS)[number]

export function CodeTabs() {
  const { t } = useI18n()
  const [active, setActive] = useState<TabId>(TAB_IDS[0])
  const current = t.tabs.items[active]

  return (
    <section id="usage" className="section">
      <h2>{t.tabs.title}</h2>
      <div className="tabs" role="tablist">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === active}
            className={`tab ${id === active ? 'is-active' : ''}`}
            onClick={() => setActive(id)}
          >
            {t.tabs.items[id].label}
          </button>
        ))}
      </div>
      <p className="tab-hint">{current.hint}</p>
      <pre className="code">
        <code>{current.code}</code>
      </pre>
      <p className="note">
        <RichText text={t.tabs.note} />
      </p>
    </section>
  )
}
