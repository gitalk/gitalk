<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import { options } from './config'
import { snippet } from './snippet'

const REPO_URL = 'https://github.com/gitalk/gitalk'
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Gitalk 落地页">
        <span class="brand-dot" aria-hidden="true" />
        <span>Gitalk</span>
      </a>
      <span class="badge">Vue</span>
      <a class="back" href="/">← 返回落地页</a>
    </header>

    <main>
      <section class="intro">
        <p class="eyebrow">// framework demo</p>
        <h1>Vue 绑定</h1>
        <p class="lede">
          这是真实的 <code>@aifire/gitalk-vue</code> 组件，可登录、可发评论。评论读写的是
          gitalk/gitalk 的 #607 讨论，与落地页演示共用同一个线程。
        </p>
      </section>

      <section class="demo" aria-label="评论演示">
        <Gitalk :options="options" />
      </section>

      <section class="usage">
        <div class="usage-head">
          <h2>怎么用</h2>
          <span class="hint">src/app.vue 的核心几行</span>
        </div>
        <pre class="code"><code>{{ snippet }}</code></pre>
        <p class="more">
          安装：<code>pnpm add @aifire/gitalk-vue @aifire/gitalk</code>
        </p>
      </section>
    </main>

    <footer class="footer">
      <a href="/">← 返回落地页</a>
      <a :href="REPO_URL" target="_blank" rel="noopener noreferrer">GitHub 仓库</a>
    </footer>
  </div>
</template>
