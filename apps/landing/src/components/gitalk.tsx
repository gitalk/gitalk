import { useEffect, useRef } from 'react'
import { mount, type MountResult } from '@aifire/gitalk'
import type { GitalkOptions } from '@aifire/gitalk'

/**
 * Demo host for the landing page. Mounts the framework-agnostic core directly
 * (rather than going through `@aifire/gitalk-react`) so the page proves the
 * no-framework path works in a real browser.
 */
export function Gitalk({
  options,
  className
}: {
  options: GitalkOptions
  className?: string
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    instanceRef.current?.update(options)
  }, [options])

  return <div ref={hostRef} className={className} />
}
