import { useI18n } from '../i18n'

export interface StatItem {
  id: 'lines' | 'comments' | 'size' | 'deps' | 'stars'
  value: string
  unit?: string
  label: string
  note: string
}

/**
 * The six headline numbers, in one place so the compact row in the hero and
 * the heavier cards underneath can never drift apart.
 *
 * Two of the values are build facts, not copy:
 * — `__GITALK_GZIP__` is measured from the widget artifact in vite.config.ts.
 * — `__GITALK_STARS__` is injected by the deploy workflow. It is empty in a
 *   local build, and the `'7.2k'` below is a layout placeholder only — never a
 *   claim about the repository's current star count.
 */
export function useStats(): StatItem[] {
  const { t } = useI18n()
  const { stats } = t.hero

  // An unbuilt core means no measurement; an em dash is honest where a stale
  // number would not be.
  const gzip = __GITALK_GZIP__
  const stars = __GITALK_STARS__ || '7.2k'

  return [
    { id: 'lines', ...stats.lines },
    { id: 'comments', ...stats.comments },
    { id: 'size', ...stats.size, value: gzip || '—', unit: gzip ? 'kB' : undefined },
    { id: 'deps', ...stats.deps },
    { id: 'stars', ...stats.stars, value: stars }
  ]
}

/** Compact three-column pair of rows that sits under the hero copy. */
export function HeroStats({ items }: { items: StatItem[] }) {
  return (
    <div className="hero-stats">
      {items.map((item) => (
        <div key={item.id}>
          <b>
            {/* Numbers and units are a single left-to-right run even when the
                surrounding paragraph is RTL; `bdi` isolates it while leaving
                the alignment to the enclosing column. */}
            <bdi dir="ltr">
              {item.value}
              {item.unit ? <small>{item.unit}</small> : null}
            </bdi>
          </b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The same six metrics as full-width cards. Deliberately heavier than the hero
 * row: a large figure, an index, and a sentence of context.
 */
export function StatCards({ items }: { items: StatItem[] }) {
  const { t } = useI18n()

  return (
    <section className="stats-band" aria-label={t.hero.statsTitle}>
      <div className="stat-cards">
        {items.map((item) => (
          <article className="stat-card" key={item.id}>
            <b className="stat-card-value">
              <bdi dir="ltr">
                {item.value}
                {item.unit ? <small>{item.unit}</small> : null}
              </bdi>
            </b>
            <span className="stat-card-label">{item.label}</span>
            <p className="stat-card-note">{item.note}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
