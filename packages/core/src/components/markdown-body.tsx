import { useLayoutEffect, useRef } from 'preact/hooks'

interface MarkdownBodyProps {
  /** Server-rendered (already sanitised) GitHub Markdown. */
  html: string
  className?: string
  /** The surrounding widget is mirrored; only then do URLs need a hint. */
  rtl?: boolean
}

/** A URL in link text starts a left-to-right identifier, not prose. */
const URL_LABEL = /^(?:https?:\/\/|www\.)/i

/**
 * A rendered Markdown block with the one bit of direction CSS cannot infer.
 *
 * `unicode-bidi: plaintext` already makes a URL run left-to-right, but the
 * element's *computed* direction stays the paragraph's, and a `target` link
 * whose label is a URL can still contribute the wrong neutral characters to
 * the line. Walking the anchors and pinning `dir="ltr"` on the ones whose
 * visible text is a URL fixes both. It only runs in an RTL widget: the LTR
 * locales keep exactly the DOM they had before.
 */
export function MarkdownBody({ html, className, rtl = false }: MarkdownBodyProps) {
  const ref = useRef<HTMLDivElement>(null)
  const annotated = useRef<HTMLAnchorElement[]>([])

  useLayoutEffect(() => {
    // Clean the previous pass first: a language switch back to LTR has to
    // leave the anchor exactly as GitHub rendered it.
    for (const anchor of annotated.current) anchor.removeAttribute('dir')
    annotated.current = []

    const root = ref.current
    if (!root || !rtl) return
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      if (!URL_LABEL.test(anchor.textContent?.trim() ?? '')) continue
      anchor.setAttribute('dir', 'ltr')
      annotated.current.push(anchor)
    }

    return () => {
      for (const anchor of annotated.current) anchor.removeAttribute('dir')
      annotated.current = []
    }
  }, [html, rtl])

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
