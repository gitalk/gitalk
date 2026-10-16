import { useEffect, useMemo, useState } from 'react'
import { Gitalk } from './components/gitalk'
import { Logo } from './components/logo'
import { CodeTabs } from './components/code-tabs'
import { Hero } from './components/hero'
import { Features } from './components/features'
import { BackendExplainer } from './components/backend-explainer'

export function App() {
  const [dark, setDark] = useState<boolean>(() => prefersDark())

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  const counts = useMemo(
    () => ({
      stars: '38.9k',
      size: '18.3 kB',
      deps: '1'
    }),
    []
  )

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <Logo className="brand-mark" />
          <span className="brand-name">Gitalk</span>
          <span className="brand-tag">2.0</span>
        </div>
        <nav className="topnav">
          <a href="#features">特性</a>
          <a href="#usage">用法</a>
          <a href="#demo">Demo</a>
          <a
            className="btn btn-ghost"
            href="https://github.com/gitalk/gitalk"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setDark((v) => !v)}
            aria-label="Toggle theme"
          >
            {dark ? '☀' : '☾'}
          </button>
        </nav>
      </header>

      <Hero counts={counts} />
      <Features />
      <BackendExplainer />
      <CodeTabs />
      <section id="demo" className="section demo-section">
        <h2>实时 Demo</h2>
        <p className="lede">
          下面的评论框就是 <code>@aifire/gitalk</code> 本身。它直接读取{' '}
          <code>gitalk/gitalk</code> 的 Discussions，匿名即可查看，登录后可评论。
        </p>
        <GitalkDemo />
      </section>

      <footer className="footer">
        <span>
          Gitalk 2.0 · MIT · powered by{' '}
          <a href="https://github.com/gitalk/gitalk" target="_blank" rel="noopener noreferrer">
            GitHub Discussions
          </a>
        </span>
      </footer>
    </div>
  )
}

/**
 * The two token endpoints the demo can talk to.
 *
 * Both stay deployed on purpose: the Cloudflare worker is the default every
 * widget uses, and the CloudBase function exists because `*.workers.dev` is
 * unreachable from mainland China. Letting visitors switch shows what that
 * difference actually buys instead of only describing it.
 */
const DEMO_ENDPOINTS = [
  { id: 'cloudflare', label: 'Cloudflare', proxy: 'https://gitalk-proxy.aispin-abf.workers.dev' },
  { id: 'cloudbase', label: '腾讯云 CloudBase', proxy: 'https://gitalk.xsin.work' }
] as const

function GitalkDemo() {
  const [endpoint, setEndpoint] = useState<(typeof DEMO_ENDPOINTS)[number]>(DEMO_ENDPOINTS[0])

  const options = {
    clientID: 'Iv23liM54pLB6TIqnqb6',
    proxy: endpoint.proxy,
    owner: 'gitalk',
    repo: 'gitalk',
    admin: ['booxood'],
    id: 'gitalk-demo-thread',
    number: 442,
    backend: 'discussions' as const,
    perPage: 10
  }

  return (
    <>
      <div className="demo-endpoints" role="group" aria-label="令牌端点">
        {DEMO_ENDPOINTS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === endpoint.id ? 'is-active' : ''}
            aria-pressed={candidate.id === endpoint.id}
            onClick={() => setEndpoint(candidate)}
          >
            {candidate.label}
          </button>
        ))}
      </div>
      {/* Keyed on the endpoint: changing `options` alone would not re-initialise
          the widget, so the switch would appear to do nothing. */}
      <Gitalk key={endpoint.proxy} options={options} className="demo-widget" />
    </>
  )
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
