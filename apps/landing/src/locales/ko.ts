import type { Messages } from '../i18n'
import { CDN_SCRIPT } from '../snippets'

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
    faq: 'FAQ',
    v1Title: 'Gitalk 1.x 이전 사이트',
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
      lines: { value: '4', label: '단계로 도입', note: '저장소 준비, App 생성과 설치, 배포, 삽입.' },
      comments: { value: '∞', label: '댓글 용량', note: 'GitHub Discussions가 담당합니다.' },
      size: { label: '가장 작지는 않지만 가장 강력', note: 'gzip 압축 후 실제 전송 크기입니다.' },
      deps: { value: '0', label: '런타임 의존성', note: '렌더링 계층은 빌드에 포함됩니다.' },
      stars: { label: 'Stars', note: 'GitHub에서의 커뮤니티 관심도.' }
    },
    modeLabel: '레이아웃 모드', endpointLabel: '엔드포인트', modeDefault: '기본', modeInline: '인라인'
  },
  getStarted: {
    eyebrow: '설정',
    title: '4단계로 댓글 연결',
    lede: '순서를 바꿀 수 없습니다. 저장소를 준비하고, App을 만들어 그 저장소에 설치하고, proxy를 배포해 callback URL을 설정한 뒤 컴포넌트를 넣습니다. 전체 안내는 한 곳에만 있습니다.',
    steps: [
      {
        title: '저장소 준비',
        body: 'public이어야 하고, Discussions를 켜야 하며(Settings → General → Features → Discussions), 카테고리가 하나 이상 있어야 합니다.',
        code: ''
      },
      {
        title: 'GitHub App 생성 후 저장소에 설치',
        body: '권한은 Discussions: Read and write와 Metadata: Read-only면 충분합니다. ⚠️ 생성만으로는 부족합니다. 설치가 없으면 proxy가 installation token을 받지 못해 익명 읽기가 시간당 60회로 떨어집니다.',
        code: ''
      },
      {
        title: 'proxy 배포 후 callback URL 설정',
        body: '명령 하나로 배포됩니다. 출력된 주소를 기다렸다가 Callback URL에 <주소>/oauth/callback을 넣으세요.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: '컴포넌트 넣기',
        body: 'clientID, owner, repo, admin, number와 배포에서 나온 proxy를 넘기면 됩니다.',
        code: ''
      }
    ],
    more: '전체 단계 — 자격 증명, .env, CloudBase, 모든 변수 → 배포 CLI README',
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
  faq: {
    eyebrow: '// FAQ',
    title: '자주 묻는 질문',
    items: [
      {
        q: 'CDN으로 바로 불러올 수 있나요?',
        a: '컴포넌트 자체는 가능합니다. 다만 로그인과 댓글 작성은 공식 proxy를 함께 쓸 수 없습니다 — 공식 proxy는 이 프로젝트 자체 사이트만 허용하며 프로젝트 자체 App에서 실행됩니다. 자기 사이트용으로 하나 더 배포하세요(명령 한 줄, 약 5분).',
        code: CDN_SCRIPT
      },
      {
        q: 'proxy를 꼭 배포해야 하나요?',
        a: '댓글 읽기만 한다면 필요 없습니다 — 브라우저가 GitHub REST에 직접 접속하고 익명 한도는 시간당 60회입니다. 로그인, 댓글 작성, reaction에는 필요합니다. GitHub의 token 엔드포인트가 CORS 헤더를 반환하지 않기 때문입니다.',
        code: ''
      },
      {
        q: '데이터는 어디에 저장되나요?',
        a: '자신의 저장소입니다 — Discussions 또는 Issues. 중간 서버가 없고 언제든 GitHub에서 내보내거나 옮길 수 있습니다.',
        code: ''
      },
      {
        q: 'v1에서 어떻게 이전하나요?',
        a: "`clientID`를 바꾸고 `proxy`를 추가하면 됩니다. 기존 사이트는 `backend: 'issues'`를 설정해 원래 Issue를 그대로 쓸 수 있어 데이터 이전이 필요 없습니다.",
        code: ''
      },
      {
        q: '댓글에 닉네임 대신 사용자 이름이 표시되는 이유는?',
        a: '기본값은 닉네임(GitHub display name)이고, 닉네임이 없으면 사용자 이름을 표시합니다. `@` 멘션은 항상 사용자 이름입니다 — 닉네임은 GitHub에서 확인할 수 없기 때문입니다.',
        code: ''
      },
      {
        q: '어떤 프레임워크를 지원하나요?',
        a: '프레임워크 없음(`<div>` 하나 + 생성자 하나), React, Vue. 스타일, 다크 모드, 11개 언어(페르시아어 RTL 포함)는 컴포넌트에 포함되어 있습니다.',
        code: ''
      },
      {
        q: '무료인가요?',
        a: '컴포넌트는 MIT입니다. proxy는 각 플랫폼의 무료 한도로 대부분 사이트에 충분합니다. 서버 비용도, 유료 플랜도 없습니다.',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · GitHub Discussions 기반',
    repo: '저장소 보기'
  }
}
