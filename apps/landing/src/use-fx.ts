import { useEffect } from 'react'

/**
 * Three behaviours the design has that a static page does not:
 *
 * - the header turns frosted once the page scrolls under it;
 * - cards tilt a few degrees towards the pointer, the way the comment rows do;
 * - the aurora picks up a soft brand-tinted glow that follows the pointer.
 *
 * All three are skipped entirely under `prefers-reduced-motion: reduce`, which
 * is also the only reason this is worth a hook rather than CSS.
 */
export function useFx(): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const nav = document.querySelector('.nav')
    const aurora = document.querySelector<HTMLElement>('.aurora')
    const CARDS = '.stat-card, .feature-card'
    let tilted: HTMLElement | null = null

    const onScroll = () => {
      // A couple of pixels of slack: a scroll of 1 is a rounding artefact.
      nav?.classList.toggle('is-scrolled', window.scrollY > 8)
    }

    const onMove = (event: PointerEvent) => {
      aurora?.style.setProperty('--mx', `${((event.clientX / window.innerWidth) * 100).toFixed(1)}%`)
      aurora?.style.setProperty('--my', `${((event.clientY / window.innerHeight) * 100).toFixed(1)}%`)

      const card = (event.target as Element | null)?.closest?.(CARDS) as HTMLElement | null
      if (card !== tilted) {
        tilted?.style.removeProperty('--rx')
        tilted?.style.removeProperty('--ry')
        tilted = card
      }
      if (card) {
        const rect = card.getBoundingClientRect()
        const dx = (event.clientX - rect.left) / rect.width - 0.5
        const dy = (event.clientY - rect.top) / rect.height - 0.5
        card.style.setProperty('--rx', `${(dy * -4).toFixed(2)}deg`)
        card.style.setProperty('--ry', `${(dx * 4).toFixed(2)}deg`)
      }
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
}
