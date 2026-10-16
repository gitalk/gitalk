import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { mount, type MountResult } from '@gitalk/core'
import type { GitalkOptions } from '@gitalk/core'

export interface GitalkProps {
  options: GitalkOptions
  className?: string
  style?: CSSProperties
}

/**
 * React wrapper around the framework-agnostic core.
 *
 * The core renders with Preact internally, bundled inside `@gitalk/core`. That
 * is deliberate: mounting the widget inside React's own tree would couple it to
 * whichever React version the host app uses, whereas delegating to Preact keeps
 * versions independent and lets the same core serve Vue and plain-script users.
 */
export function Gitalk({ options, className, style }: GitalkProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<MountResult | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    instanceRef.current = mount(host, options)
    return () => {
      instanceRef.current?.unmount()
      instanceRef.current = null
    }
    // Mounting is imperative and expensive; option changes are pushed through
    // `update` below rather than remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    instanceRef.current?.update(options)
  }, [options])

  return <div ref={hostRef} className={className} style={style} />
}

export default Gitalk
