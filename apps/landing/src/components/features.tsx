const FEATURES = [
  {
    title: 'Discussions 默认承载',
    body: '评论落在 Discussions 里，不污染 issue 列表，也没有 v1 那个「label 超过 50 字符就报错」的坑。'
  },
  {
    title: 'Issues 可选兼容',
    body: '老站点设 backend: "issues" 即可沿用原来的数据，迁移可以一页一页慢慢来。'
  },
  {
    title: '无框架 / React / Vue',
    body: '同一个内核，三种用法。包装层各自不到 1 kB，且不会和你项目里的框架版本打架。'
  },
  {
    title: '不再泄露 secret',
    body: 'v1 把 clientSecret 写进前端、再发给陌生代理。2.0 改为你自部署的 edge function，浏览器里没有密钥。'
  },
  {
    title: '零运行时依赖',
    body: '渲染层只有 Preact。日期用原生 Intl.RelativeTimeFormat，Markdown 用 GitHub 渲染好的 HTML。'
  },
  {
    title: '现代工具链',
    body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm monorepo · release-please 自动发版。'
  }
]

export function Features() {
  return (
    <section id="features" className="section">
      <h2>为什么是 2.0</h2>
      <div className="grid">
        {FEATURES.map((f) => (
          <article key={f.title} className="card">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
