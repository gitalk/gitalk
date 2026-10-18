import { useEffect, useState } from 'react'
import { useFx } from './use-fx'
import { ChevronDown, Moon, Sun } from 'lucide-react'
import { Logo } from './components/logo'
import { GithubIcon } from './components/github-icon'
import { AuroraShader } from './components/aurora-shader'
import { AmbientToggle } from './components/ambient-toggle'
import { Hero } from './components/hero'
import { GetStarted } from './components/get-started'
import { Features } from './components/features'
import { BackendExplainer } from './components/backend-explainer'
import { CodeTabs } from './components/code-tabs'
import { htmlLang, LANGS, useI18n } from './i18n'

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

          <span className="lang-picker">
            <select
              value={lang}
              onChange={(event) => {
                const next = LANGS.find((option) => option.id === event.target.value)?.id
                if (next) setLang(next)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
                // Chrome exposes the open list as :open; leave its own
                // navigation alone once it is showing.
                if (event.currentTarget.matches(':open')) return
                event.preventDefault()
                const index = LANGS.findIndex((option) => option.id === lang)
                const step = event.key === 'ArrowDown' ? 1 : -1
                const next = LANGS[(index + step + LANGS.length) % LANGS.length]
                if (next) setLang(next.id)
              }}
              aria-label={t.nav.language}
              title={t.nav.language}
              lang={htmlLang(lang)}
            >
              {LANGS.map((option) => (
                <option key={option.id} value={option.id} lang={htmlLang(option.id)}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={11} strokeWidth={2} aria-hidden="true" />
          </span>

          <button
            type="button"
            className="nav-ctl"
            onClick={() => setDark((value) => !value)}
            aria-label={t.nav.theme}
            title={t.nav.theme}
          >
            {dark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
          </button>

          <AmbientToggle />
        </nav>
      </header>

      <main id="top">
        <Hero />
        <Features />
        <BackendExplainer />
        <GetStarted />
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
