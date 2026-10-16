import { useState } from 'react'

const SNIPPETS: Array<{ id: string; label: string; hint: string; code: string }> = [
  {
    id: 'vanilla',
    label: '无框架',
    hint: '一个 script 标签 + 一行初始化',
    code: `<!-- 1. 引入产物 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. 容器 -->
<div id="gitalk-container"></div>

<!-- 3. 初始化 -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // 页面唯一标识
    number: 42,              // 已创建的 discussion 编号（推荐显式指定）
    backend: 'discussions',  // 默认；老站点可写 'issues'
    perPage: 10
  })

  gitalk.render('gitalk-container')
</script>`
  },
  {
    id: 'react',
    label: 'React',
    hint: 'peerDependency: react >= 18',
    code: `import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

export function Comments() {
  return (
    <Gitalk
      options={{
        clientID: 'Iv1.xxxxxxxx',
        owner: 'you',
        repo: 'comments',
        admin: ['you'],
        number: 42,
        backend: 'discussions',
        perPage: 10
      }}
    />
  )
}`
  },
  {
    id: 'vue',
    label: 'Vue',
    hint: 'peerDependency: vue >= 3.4',
    code: `<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
  clientID: 'Iv1.xxxxxxxx',
  owner: 'you',
  repo: 'comments',
  admin: ['you'],
  number: 42,
  backend: 'discussions',
  perPage: 10
}
</script>

<template>
  <Gitalk :options="options" />
</template>`
  }
]

export function CodeTabs() {
  const [active, setActive] = useState(SNIPPETS[0]!.id)
  const current = SNIPPETS.find((s) => s.id === active)!

  return (
    <section id="usage" className="section">
      <h2>三种用法</h2>
      <div className="tabs" role="tablist">
        {SNIPPETS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === active}
            className={`tab ${s.id === active ? 'is-active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="tab-hint">{current.hint}</p>
      <pre className="code">
        <code>{current.code}</code>
      </pre>
      <p className="note">
        登录需要在 <code>proxy</code> 里指向你自己部署的 edge function——
        因为 <code>github.com/login/oauth/access_token</code> 不返回 CORS 头，浏览器
        无法自行完成 token 交换。源码在 <code>packages/proxy-worker</code>，
        支持 Cloudflare Workers / Vercel / Netlify 一键部署。
      </p>
    </section>
  )
}
