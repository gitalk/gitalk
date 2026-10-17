import { useEffect, useState } from 'react'
import { Logo } from './components/logo'
import { CodeTabs } from './components/code-tabs'
import { Hero } from './components/hero'
import { Stats, type HeroCounts } from './components/stats'
import { Features } from './components/features'
import { BackendExplainer } from './components/backend-explainer'
import { LANGS, useI18n } from './i18n'

/**
 * Everything here is measured, not typed. The sizes come from the artifact the
 * page loads (see vite.config.ts) and the star count from the deploy workflow;
 * both were literals once and both drifted.
 */
// CI injects the real count; a dev server has no workflow to read it, so fall
// back to the value that was current when this was written. It exists so the
// strip can be laid out and reviewed locally, and it is never what production
// shows — the deploy overwrites it.
const stars = __GITALK_STARS__ || '7.2k'
const COUNTS: HeroCounts = {
  // "Size" is the transfer size (gzip), which is what the old 18.3 kB figure
  // claimed; the raw artifact stays available as __GITALK_RAW__ if needed.
  size: { value: __GITALK_GZIP__, unit: 'kB' },
  deps: { value: '1' },
  stars: stars ? { value: stars.replace(/k$/, ''), unit: 'k' } : { value: '' }
}

export function App() {
  const { lang, setLang, t } = useI18n()
  const [dark, setDark] = useState<boolean>(() => prefersDark())

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <Logo className="brand-mark" />
          <span className="brand-name">Gitalk</span>
          <span className="brand-tag">2.0</span>
        </div>
        <nav className="topnav">
          <a href="#features">{t.nav.features}</a>
          <a href="#usage">{t.nav.usage}</a>
          <a href="#demo">{t.nav.demo}</a>
          <a
            className="btn btn-ghost"
            href="https://github.com/gitalk/gitalk"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <div className="lang-switch" role="group" aria-label={t.nav.language}>
            {LANGS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === lang ? 'is-active' : ''}
                aria-pressed={option.id === lang}
                onClick={() => setLang(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setDark((v) => !v)}
            aria-label={t.nav.theme}
          >
            {dark ? '☀' : '☾'}
          </button>
        </nav>
      </header>

      <Hero dark={dark} />
      <Stats counts={COUNTS} />
      <Features />
      <BackendExplainer />
      <CodeTabs />

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

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
