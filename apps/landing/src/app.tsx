import { useEffect, useState } from 'react'
import { useFx } from './use-fx'
import { Moon, Sun } from 'lucide-react'
import { Logo } from './components/logo'
import { GithubIcon } from './components/github-icon'
import { AuroraShader } from './components/aurora-shader'
import { Hero } from './components/hero'
import { Features } from './components/features'
import { BackendExplainer } from './components/backend-explainer'
import { CodeTabs } from './components/code-tabs'
import { LANGS, useI18n } from './i18n'

const REPO_URL = 'https://github.com/gitalk/gitalk'

/**
 * Injected by vite from packages/core/package.json, so the bubble always names
 * the version the page is actually shipping rather than one typed into copy.
 */
const VERSION = `v${__GITALK_VERSION__}`

export function App() {
  const { lang, setLang, t } = useI18n()
  const [dark, setDark] = useState<boolean>(() => prefersDark())
  useFx()

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <div className="page">
      <div className="aurora" aria-hidden="true">
        <AuroraShader theme={dark ? 'dark' : 'light'} />
      </div>
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <header className="nav">
        <a className="brand" href="#top" aria-label="Gitalk">
          <Logo className="brand-mark" />
          <span className="brand-name">Gitalk</span>
          <span className="version-pill">{VERSION}</span>
        </a>

        <nav className="nav-links" aria-label="Gitalk">
          <a className="nav-link" href="#features">
            {t.nav.features}
          </a>
          <a className="nav-link" href="#usage">
            {t.nav.usage}
          </a>
          <a className="nav-link" href="#demo">
            {t.nav.demo}
          </a>

          <span className="nav-divider" aria-hidden="true" />

          <a
            className="nav-ctl"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.nav.github}
            title={t.nav.github}
          >
            <GithubIcon size={15} />
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
            className="nav-ctl"
            onClick={() => setDark((value) => !value)}
            aria-label={t.nav.theme}
            title={t.nav.theme}
          >
            {dark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
          </button>
        </nav>
      </header>

      <main id="top">
        <Hero />
        <Features />
        <BackendExplainer />
        <CodeTabs />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-left">
            <span className="footer-name">Gitalk</span>
            <span className="version-pill">{VERSION}</span>
            <span className="footer-note">{t.footer.note}</span>
          </div>
          <a className="footer-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <GithubIcon size={14} />
            {t.footer.repo}
          </a>
        </div>
      </footer>
    </div>
  )
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
