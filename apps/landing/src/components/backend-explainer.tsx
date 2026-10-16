/**
 * Explains the anonymous/authenticated split, which is the single most
 * surprising part of the design: REST can be read anonymously, GraphQL cannot
 * be reached anonymously at all. See docs/tech.md §2.1.
 */
export function BackendExplainer() {
  return (
    <section className="section explainer">
      <h2>数据是怎么流动的</h2>
      <div className="flow">
        <div className="flow-col">
          <h3>匿名访客</h3>
          <p className="flow-badge flow-badge-free">无需登录</p>
          <ul>
            <li>经 REST API 读取评论（60 次/小时/IP）</li>
            <li>直接拿到 GitHub 渲染好的 HTML</li>
            <li>带 ETag 的重复请求不计入限额</li>
          </ul>
        </div>
        <div className="flow-arrow" aria-hidden="true">
          →
        </div>
        <div className="flow-col">
          <h3>登录用户</h3>
          <p className="flow-badge flow-badge-auth">OAuth</p>
          <ul>
            <li>经 GraphQL 评论、回复、点赞</li>
            <li>5000 点/小时，成本每条查询 1 点</li>
            <li>token 存 localStorage，可随时注销</li>
          </ul>
        </div>
      </div>
      <p className="note">
        写操作必须走 GraphQL，因为 GitHub 没有 Discussions 的 REST 写接口（实测连{' '}
        <code>POST</code> 路由都不存在）。而 GraphQL 的匿名额度是 <code>0</code>，
        所以「匿名读 + 登录写」是这套架构的必然形态，不是偷懒。
      </p>
    </section>
  )
}
