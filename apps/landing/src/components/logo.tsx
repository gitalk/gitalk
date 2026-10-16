import { useId, type CSSProperties } from 'react'

/**
 * Gitalk brand mark: a speech bubble whose two bars stand for a root comment
 * and its reply. Drawn with `currentColor` so it inherits the surrounding text
 * colour, and with the bars knocked out via a mask so they read as holes
 * rather than filled shapes.
 */
export function Logo({ className, style }: { className?: string; style?: CSSProperties }) {
  // useId keeps the mask unique if the mark is ever rendered more than once.
  // Colons are stripped because they are not valid inside `url(#…)`.
  const maskId = `gitalk-mark-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`

  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      style={style}
      role="img"
      aria-label="Gitalk logo"
    >
      <mask id={maskId}>
        <rect width="1024" height="1024" fill="#fff" />
        <rect x="330" y="308" width="364" height="104" rx="52" fill="#000" />
        <rect x="330" y="476" width="228" height="104" rx="52" fill="#000" />
      </mask>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <circle cx="512" cy="444" r="300" />
        <path d="M368 700H516L360 880Z" />
      </g>
    </svg>
  )
}
