import { useMemo, useState } from 'react'
import { Gitalk } from './gitalk'
import { useI18n } from '../i18n'

/**
 * The two token endpoints the demo can talk to.
 *
 * Both stay deployed on purpose: the Cloudflare worker is the default every
 * widget uses, and the CloudBase function exists because `*.workers.dev` is
 * unreachable from mainland China. Letting visitors switch shows what that
 * difference actually buys instead of only describing it.
 *
 * Labels come from the dictionary; only the ids and URLs live here.
 */
const DEMO_ENDPOINTS = [
  { id: 'cloudflare', proxy: 'https://gitalk-proxy.aispin-abf.workers.dev' },
  { id: 'cloudbase', proxy: 'https://gitalk.xsin.work' }
] as const

/**
 * The live widget, dressed as a small browser window so it can sit inside the
 * hero's laptop mockup. Kept in one place: the hero wraps this in the CSS
 * device frame, and nothing else on the page mounts a second copy.
 */
export function GitalkDemo() {
  const { t, lang } = useI18n()
  const [endpoint, setEndpoint] = useState<(typeof DEMO_ENDPOINTS)[number]>(DEMO_ENDPOINTS[0])

  const options = useMemo(
    () => ({
      clientID: 'Iv23liM54pLB6TIqnqb6',
      proxy: endpoint.proxy,
      owner: 'gitalk',
      repo: 'gitalk',
      admin: ['booxood'],
      id: 'gitalk-demo-thread',
      number: 442,
      backend: 'discussions' as const,
      perPage: 10,
      // The widget localises its own chrome and relative dates; keep it in
      // step with the page language instead of letting it fall back to the
      // browser locale.
      language: lang === 'zh' ? 'zh-CN' : 'en'
    }),
    [endpoint, lang]
  )

  return (
    <div className="gitalk-demo">
      <div className="demo-chrome" aria-hidden="true">
        <span className="demo-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="demo-url">gitalk.github.io/comments</span>
        <span className="demo-live">
          <span className="demo-live-dot" />
          {t.demo.live}
        </span>
      </div>

      <div className="demo-stage">
        {/* Keyed on the endpoint: changing `options` alone would not
            re-initialise the widget, so the switch would appear to do nothing. */}
        <Gitalk key={endpoint.proxy} options={options} className="demo-widget" />
      </div>

      <div className="demo-status">
        <span className="demo-status-label">{t.demo.endpointsLabel}</span>
        <div className="demo-endpoints" role="group" aria-label={t.demo.endpointsLabel}>
          {DEMO_ENDPOINTS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={candidate.id === endpoint.id ? 'is-active' : ''}
              aria-pressed={candidate.id === endpoint.id}
              onClick={() => setEndpoint(candidate)}
            >
              {t.demo.endpoints[candidate.id]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
