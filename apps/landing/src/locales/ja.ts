import type { Messages } from '../i18n'

/** Japanese. Typed against `zh`, the source locale. */
export const ja: Messages = {
  meta: {
    title: 'Gitalk 2.0 — GitHub Discussions ベースのコメントコンポーネント',
    description:
      'Gitalk 2.0：GitHub Discussions を基盤にしたコメントコンポーネント。フレームワークなし、React、Vue の3種類のビルドを提供します。'
  },
  nav: {
    features: '機能',
    usage: '使い方',
    demo: 'デモ',
    theme: 'テーマを切り替え',
    language: '言語を切り替え',
    github: 'GitHub リポジトリ'
  },
  ambient: {
    aria: '環境音：{season} · {state}',
    stateOn: 'オン',
    stateOff: 'オフ',
    defaultTag: '（既定）',
    hint: 'クリックで切り替え · 右クリックまたは ← → で季節 · ↑ ↓ で音量（{volume}%）',
    seasons: {
      spring: '春の雨',
      summer: '夏の虫',
      autumn: '秋の火',
      winter: '冬の雪'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'コメント欄を、',
    titleLine2: '一行のコードで',
    titleEm: '軽く',
    lede: 'GitHub Discussions または Issues をコメント欄に。コマンド1つで軽量プロキシをデプロイ。データベース不要で、コメントはリアルタイムに同期します。',
    statsTitle: '主な数値',
    stats: {
      lines: { value: '4', label: 'ステップで導入', note: 'App の作成、値の入力、デプロイ、組み込み。この4ステップです。' },
      comments: { value: '∞', label: 'コメント数', note: 'GitHub Discussions が担います。' },
      size: { label: '最小ではない', note: 'gzip 後の実際の転送サイズ。' },
      deps: { value: '0', label: '実行時依存', note: '描画層はビルドに含まれます。' },
      stars: { label: 'Stars', note: 'GitHub でのコミュニティの注目度。' }
    },
    modeLabel: 'レイアウトモード', endpointLabel: 'エンドポイント', modeDefault: '既定', modeInline: 'インライン'
  },
  getStarted: {
    eyebrow: 'セットアップ',
    title: '4ステップでコメントを導入',
    lede: '3つはあなたが行う作業（App の作成、値の入力、コンポーネントの組み込み）で、1つはコマンドです。順序は入れ替えられません。ステップ3は、ステップ2の値が揃ってから実行します。',
    steps: [
      {
        title: 'GitHub App を作成',
        body: 'Settings → Developer settings → GitHub Apps で新規作成します。権限は Discussions: Read and write と Metadata: Read-only を選択。Callback URL には <プロキシのアドレス>/oauth/callback を入力し、Webhook はオフにします（使いません）。',
        code: ''
      },
      {
        title: '環境変数を用意',
        body: 'App ID、Client ID、Client Secret、秘密鍵（.pem の全文。SHA256 の指紋ではありません）を .env に書き、セッションキーは openssl rand -hex 32 で生成します。',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: 'コマンド1つでデプロイ',
        body: 'CLI はまずすべての値を検証し（足りないものがあれば具体的に示します）、資格情報を secret としてアップロードしてからデプロイし、/health を自己診断したうえで、proxy に入れるアドレスを出力します。',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'コンポーネントを組み込む',
        body: '前のステップで出力されたアドレスを proxy に渡せば、コメントが使えます。スタイル、ダークモード、多言語はコンポーネント側が持ちます。',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase、セルフホスト、すべての変数の説明 → デプロイ CLI の README',
    domainTitle: 'カスタムドメイン',
    domainBody: 'Cloudflare 上のドメインはそのまま紐付けられます。それ以外では、ドメイン事業者で CNAME レコードを1件追加する必要があります。CloudBase のカスタムドメインには ICP 登録も必要です。この2つは手作業になります。GitHub App の callback URL も Web UI でしか変更できません（org 所有の App は API から変更できません）。'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 はコアを書き直しました。既定は Discussions、書き込みは OAuth、ブラウザに秘密鍵はありません。',
    items: [
      {
        title: 'Discussions が既定',
        body: 'コメントは Discussions に残るので issue 一覧を汚しません。v1 の「ラベルが50文字を超えると失敗する」問題もありません。'
      },
      {
        title: 'Issues も選択可能',
        body: '既存サイトは backend: "issues" を設定すれば元のデータをそのまま使えます。移行は1ページずつ進められます。'
      },
      {
        title: 'フレームワークなし / React / Vue',
        body: '同じコアを3通りの使い方で。各ラッパーは 1 kB 未満で、プロジェクトのフレームワークのバージョンと衝突しません。'
      },
      {
        title: 'secret を漏らさない',
        body: 'v1 は clientSecret をフロントエンドに書き、第三者のプロキシに送っていました。2.0 は自分でデプロイする edge function を使うので、ブラウザに秘密鍵はありません。'
      },
      {
        title: '実行時依存ゼロ',
        body: '描画層は Preact のみ。日付はネイティブの Intl.RelativeTimeFormat、Markdown は GitHub が描画した HTML を使います。'
      },
      {
        title: 'モダンなツールチェーン',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm monorepo · release-please による自動リリース。'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'データの流れ',
    lede: '読み取りは匿名、書き込みはログイン。これは制限ではなく、GitHub の API の形から導かれる唯一の解です。',
    anonTitle: '匿名の訪問者',
    anonBadge: 'ログイン不要',
    anonPoints: [
      'REST API でコメントを読む（60 回/時/IP）',
      'GitHub が描画した HTML をそのまま受け取る',
      'ETag 付きの再リクエストは制限に数えない'
    ],
    authTitle: 'ログインしたユーザー',
    authBadge: 'OAuth',
    authPoints: [
      'GraphQL でコメント、返信、リアクション',
      '5000 ポイント/時、1クエリあたり1ポイント',
      'token は localStorage に保存され、いつでも失効できます'
    ],
    note: '書き込みは GraphQL を通す必要があります。GitHub には Discussions の REST 書き込み API がなく（`POST` ルート自体が存在しません）、GraphQL の匿名枠は `0` だからです。つまり「匿名で読み、ログインして書く」は、この構成が必然的に取る形であって、手抜きではありません。'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: '3つの使い方',
    lede: '同じコアから、プロジェクトに合う入口を1つ選んでください。',
    items: {
      vanilla: {
        label: 'フレームワークなし',
        hint: 'script タグ1つ + 初期化1行',
        code: `<!-- 1. ビルドを読み込む -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. コンテナ -->
<div id="gitalk-container"></div>

<!-- 3. 初期化 -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // ページの一意な識別子
    number: 42,              // 作成済み discussion の番号（明示を推奨）
    backend: 'discussions',  // 既定。旧サイトは 'issues' も可
    perPage: 10
  })

  gitalk.render('gitalk-container')
</script>`
      },
      react: {
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
      vue: {
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
    },
    note: 'ログインは必ず proxy を経由します。`github.com/login/oauth/access_token` は CORS ヘッダーを返さないため、ブラウザだけで token 交換を完了できません。デプロイは上記の4ステップ、CloudBase とセルフホストはリポジトリの README を参照してください。'
  },
  footer: {
    note: 'MIT · GitHub Discussions ベース',
    repo: 'リポジトリを見る'
  }
}
