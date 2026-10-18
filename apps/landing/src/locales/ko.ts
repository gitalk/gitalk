import type { Messages } from '../i18n'

/** Korean. Typed against `zh`, the source locale. */
export const ko: Messages = {
  meta: {
    title: 'Gitalk 2.0 — GitHub Discussions 기반 댓글 컴포넌트',
    description:
      'Gitalk 2.0: GitHub Discussions 기반 댓글 컴포넌트. 프레임워크 없음, React, Vue 세 가지 빌드를 제공합니다.'
  },
  nav: {
    features: '기능',
    usage: '사용법',
    demo: '데모',
    theme: '테마 전환',
    language: '언어 전환',
    github: 'GitHub 저장소'
  },
  ambient: {
    aria: '환경음: {season} · {state}',
    stateOn: '켜짐',
    stateOff: '꺼짐',
    defaultTag: ' (기본)',
    hint: '클릭해 전환 · 오른쪽 클릭 또는 ← → 로 계절 · ↑ ↓ 로 볼륨({volume}%)',
    seasons: {
      spring: '봄비',
      summer: '여름 벌레',
      autumn: '가을 불',
      winter: '겨울 눈'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: '댓글창,',
    titleLine2: '코드 한 줄처럼 ',
    titleEm: '가볍게',
    lede: 'GitHub Discussions 또는 Issues를 댓글창으로. 명령 하나로 가벼운 프록시를 배포하고, 데이터베이스 없이 댓글이 실시간으로 동기화됩니다.',
    statsTitle: '주요 지표',
    stats: {
      lines: { value: '5', label: '단계로 도입', note: 'App 생성, 값 입력, 배포, callback 설정, 삽입까지 다섯 단계입니다.' },
      comments: { value: '∞', label: '댓글 용량', note: 'GitHub Discussions가 담당합니다.' },
      size: { label: '가장 작지는 않지만 가장 강력', note: 'gzip 압축 후 실제 전송 크기입니다.' },
      deps: { value: '0', label: '런타임 의존성', note: '렌더링 계층은 빌드에 포함됩니다.' },
      stars: { label: 'Stars', note: 'GitHub에서의 커뮤니티 관심도.' }
    },
    modeLabel: '레이아웃 모드', endpointLabel: '엔드포인트', modeDefault: '기본', modeInline: '인라인'
  },
  getStarted: {
    eyebrow: '설정',
    title: '네 단계로 댓글 연결',
    lede: '세 단계는 직접 하시는 일(App 생성, 값 입력, 컴포넌트 삽입)이고, 한 단계는 명령 하나입니다. 순서는 바꿀 수 없습니다. 3단계는 2단계의 값이 모두 준비된 뒤에 실행합니다.',
    steps: [
      {
        title: 'GitHub App 만들기',
        body: 'Settings → Developer settings → GitHub Apps에서 새로 만듭니다. 권한은 Discussions: Read and write와 Metadata: Read-only를 선택하고, Callback URL에는 <프록시 주소>/oauth/callback을 넣습니다. Webhook은 끕니다(사용하지 않습니다).',
        code: ''
      },
      {
        title: '환경 변수 준비',
        body: 'App ID, Client ID, Client Secret, 개인 키(.pem 전체 내용. SHA256 지문이 아닙니다)를 .env에 적고, 세션 키는 openssl rand -hex 32로 생성합니다.',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: '명령 하나로 배포',
        body: 'CLI가 먼저 모든 값을 검사해 빠진 항목을 정확히 알려 주고, 자격 증명을 secret으로 업로드한 뒤 배포하고 /health를 자체 점검한 다음, proxy에 넣을 주소를 출력합니다.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: '컴포넌트 삽입',
        body: '앞 단계에서 출력된 주소를 proxy에 넣으면 댓글이 동작합니다. 스타일, 다크 모드, 다국어는 컴포넌트가 함께 제공합니다.',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase, 자체 호스팅과 모든 변수 설명 → 배포 CLI README',
    domainTitle: '사용자 지정 도메인',
    domainBody: '도메인이 Cloudflare에 있으면 바로 연결할 수 있고, 다른 곳이라면 도메인 업체에서 CNAME 레코드를 하나 추가해야 합니다. CloudBase의 사용자 지정 도메인에는 ICP 등록도 필요합니다. 이 두 가지는 직접 하셔야 합니다. GitHub App의 callback URL도 웹 UI에서만 바꿀 수 있습니다(org 소유 App은 API로 변경할 수 없습니다).'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0은 코어를 다시 작성했습니다. 기본은 Discussions, 쓰기는 OAuth, 브라우저에는 비밀 키가 없습니다.',
    items: [
      {
        title: 'Discussions 기본',
        body: '댓글이 Discussions에 남아 issue 목록을 어지럽히지 않고, v1의 "레이블이 50자를 넘으면 실패" 문제도 없습니다.'
      },
      {
        title: 'Issues 선택적 호환',
        body: '기존 사이트는 backend: "issues"만 설정하면 기존 데이터를 그대로 쓸 수 있어, 한 페이지씩 천천히 이전할 수 있습니다.'
      },
      {
        title: '프레임워크 없음 / React / Vue',
        body: '같은 코어를 세 가지 방식으로. 각 래퍼는 1 kB 미만이고 프로젝트의 프레임워크 버전과 충돌하지 않습니다.'
      },
      {
        title: 'secret 노출 없음',
        body: 'v1은 clientSecret을 프런트엔드에 넣고 낯선 프록시로 보냈습니다. 2.0은 직접 배포한 edge function을 쓰므로 브라우저에 비밀 키가 없습니다.'
      },
      {
        title: '런타임 의존성 제로',
        body: '렌더링 계층은 Preact뿐입니다. 날짜는 네이티브 Intl.RelativeTimeFormat, Markdown은 GitHub가 렌더링한 HTML을 씁니다.'
      },
      {
        title: '현대적인 툴체인',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm monorepo · release-please 자동 배포.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: '데이터는 어떻게 흐르나',
    lede: '읽기는 익명, 쓰기는 로그인. 제한이 아니라 GitHub API의 형태가 만들어 낸 유일한 해법입니다.',
    anonTitle: '익명 방문자',
    anonBadge: '로그인 불필요',
    anonPoints: [
      'REST API로 댓글 읽기(시간당 IP당 60회)',
      'GitHub가 렌더링한 HTML을 그대로 받음',
      'ETag가 붙은 반복 요청은 한도에 포함되지 않음'
    ],
    authTitle: '로그인한 사용자',
    authBadge: 'OAuth',
    authPoints: [
      'GraphQL로 댓글, 답글, 반응',
      '시간당 5000포인트, 쿼리당 1포인트',
      'token은 localStorage에 저장되며 언제든 취소 가능'
    ],
    note: '쓰기는 반드시 GraphQL을 거쳐야 합니다. GitHub에는 Discussions용 REST 쓰기 API가 없고(`POST` 라우트 자체가 없습니다), GraphQL의 익명 한도는 `0`이기 때문입니다. 그래서 "익명 읽기 + 로그인 쓰기"는 이 구조가 강제하는 형태이지 요령이 아닙니다.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: '세 가지 사용법',
    lede: '같은 코어에서 프로젝트에 가장 잘 맞는 진입점을 고르세요.',
    items: {
      vanilla: {
        label: '프레임워크 없음',
        hint: 'script 태그 하나 + 초기화 한 줄',
        code: `<!-- 1. 빌드 불러오기 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. 컨테이너 -->
<div id="gitalk-container"></div>

<!-- 3. 초기화 -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // 페이지 고유 식별자
    number: 42,              // 생성된 discussion 번호(명시 권장)
    backend: 'discussions',  // 기본값. 기존 사이트는 'issues'도 가능
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
    note: '로그인은 반드시 proxy를 거칩니다. `github.com/login/oauth/access_token`은 CORS 헤더를 반환하지 않아 브라우저만으로 token 교환을 끝낼 수 없습니다. 배포 방법은 위의 네 단계와 같고, CloudBase와 자체 호스팅은 저장소 README를 보세요.'
  },
  footer: {
    note: 'MIT · GitHub Discussions 기반',
    repo: '저장소 보기'
  }
}
