export function Hero({ counts }: { counts: { stars: string; size: string; deps: string } }) {
  return (
    <section className="hero">
      <p className="eyebrow">Serverless comments · GitHub Discussions</p>
      <h1>
        把评论区
        <br />
        搬回你的仓库
      </h1>
      <p className="lede">
        Gitalk 2.0 用 GitHub Discussions 承载评论。无后端、无数据库、无第三方代理——
        匿名访客可直接阅读，登录后即可评论与点赞。
      </p>
      <div className="cta">
        <a className="btn btn-primary" href="#usage">
          开始使用
        </a>
        <a
          className="btn btn-ghost"
          href="https://github.com/gitalk/gitalk"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看源码
        </a>
      </div>
      <dl className="stats">
        <div>
          <dt>体积</dt>
          <dd>{counts.size}</dd>
        </div>
        <div>
          <dt>运行时依赖</dt>
          <dd>{counts.deps}</dd>
        </div>
        <div>
          <dt>Star</dt>
          <dd>{counts.stars}</dd>
        </div>
      </dl>
    </section>
  )
}
