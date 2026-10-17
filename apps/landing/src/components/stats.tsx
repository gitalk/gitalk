import { useI18n } from '../i18n'

export interface CountValue {
  value: string
  unit?: string
}

export interface HeroCounts {
  size: CountValue
  gzip: CountValue
  deps: CountValue
  stars: CountValue
}

/**
 * The three headline numbers, shown as a full-width strip under the hero.
 *
 * Kept out of the hero panel on purpose: inside it they competed with the
 * CTAs. The type pairing (22px/700 number, 13px muted label) mirrors the
 * widget's own `.gt-counts`, so the marketing page and the product share the
 * same way of presenting a count.
 */
export function Stats({ counts }: { counts: HeroCounts }) {
  const { t } = useI18n()

  const items = [
    { id: 'size', label: t.hero.size, ...counts.size },
    { id: 'gzip', label: t.hero.gzip, ...counts.gzip },
    { id: 'deps', label: t.hero.runtimeDeps, ...counts.deps },
    { id: 'stars', label: t.hero.stars, ...counts.stars }
    // A figure the build could not measure is omitted rather than shown blank.
  ].filter((item) => item.value)

  return (
    <dl className="stats">
      {items.map((item) => (
        <div className="stat" key={item.id}>
          <dt>{item.label}</dt>
          <dd>
            <span className="stat-number">{item.value}</span>
            {item.unit ? <span className="stat-unit">{item.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
