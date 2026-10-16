/**
 * Locale-aware relative timestamps.
 *
 * v1 pulled in `date-fns` (plus 8 locale objects) for this. Modern browsers
 * ship `Intl.RelativeTimeFormat`, which handles all locales for free — one less
 * dependency and no locale bundles to ship.
 */
const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' }
]

export function formatRelativeTime(iso: string, locale = 'en'): string {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return ''

  let duration = (target - Date.now()) / 1000

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        Math.round(duration),
        division.unit
      )
    }
    duration /= division.amount
  }

  return iso
}
