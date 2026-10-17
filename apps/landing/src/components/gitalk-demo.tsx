import { useMemo } from 'react'
import { Gitalk } from './gitalk'
import { useI18n } from '../i18n'

/**
 * The live widget, mounted straight into the hero's single `.demo` box.
 *
 * The box only positions and sizes it; the component itself is now the panel
 * (radius, border, glass, shadow, header, list and composer all ship from
 * `@aifire/gitalk`). There is deliberately no browser chrome, no stage and no
 * endpoint switcher: anything around the widget would be a second frame around
 * the frame the component already paints.
 *
 * The Cloudflare worker is the endpoint shown here — the same one the default
 * widget uses. The CloudBase mirror still exists for mainland China; pointing
 * the demo at it is a one-line change in `options.proxy`, not a UI.
 */
const DEMO_PROXY = 'https://gitalk-proxy.aispin-abf.workers.dev'

export function GitalkDemo({ mode, proxy }: { mode: "default" | "inline"; proxy: string }) {
  const { lang } = useI18n()

  const options = useMemo(
    () => ({
      clientID: 'Iv23liM54pLB6TIqnqb6',
      proxy,
      owner: 'gitalk',
      repo: 'gitalk',
      admin: ['booxood'],
      id: 'landing-comments',
      number: 442,
      backend: 'discussions' as const,
      perPage: 10,
      /*
       * The demo lives in a fixed-height box with its own flex layout: the
       * comment list scrolls and the composer is pinned to the bottom of that
       * box. The widget's viewport-fixed docking assumes a full-page embed, so
       * inside this nested scroll container it would escape the box and cover
       * the page. Core ships the option for exactly this case.
       */
      // The widget localises its own chrome and relative dates; keep it in
      // step with the page language instead of letting it fall back to the
      // browser locale.
      language: lang === 'zh' ? 'zh-CN' : 'en',
      mode
    }),
    [lang, mode, proxy]
  )

  return <Gitalk options={options} />
}
