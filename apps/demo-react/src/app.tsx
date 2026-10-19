import { Gitalk } from '@aifire/gitalk-react'
import { options } from './config'
import { snippet } from './snippet'

const REPO_URL = 'https://github.com/gitalk/gitalk'

/**
 * A runnable example, not a second landing page: the widget is the content,
 * and the snippet below it is how this file mounts it.
 */
export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Gitalk 落地页">
          <span className="brand-dot" aria-hidden="true" />
          <span>Gitalk</span>
        </a>
        <span className="badge">React</span>
        <a className="back" href="/">
          ← 返回落地页
        </a>
      </header>

      <main>
        <section className="intro">
          <p className="eyebrow">// framework demo</p>
          <h1>React 绑定</h1>
          <p className="lede">
            这是真实的 <code>@aifire/gitalk-react</code> 组件，可登录、可发评论。评论读写的是
            gitalk/gitalk 的 #607 讨论，与落地页演示共用同一个线程。
          </p>
        </section>

        <section className="demo" aria-label="评论演示">
          <Gitalk options={options} />
        </section>

        <section className="usage">
          <div className="usage-head">
            <h2>怎么用</h2>
            <span className="hint">src/app.tsx 的核心几行</span>
          </div>
          <pre className="code">
            <code>{snippet}</code>
          </pre>
          <p className="more">
            安装：<code>pnpm add @aifire/gitalk-react @aifire/gitalk</code>
          </p>
        </section>
      </main>

      <footer className="footer">
        <a href="/">← 返回落地页</a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub 仓库
        </a>
      </footer>
    </div>
  )
}
