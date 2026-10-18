import type { Messages } from '../i18n'

/** Russian. Typed against `zh`, the source locale. */
export const ru: Messages = {
  meta: {
    title: 'Gitalk 2.0 — компонент комментариев на базе GitHub Discussions',
    description:
      'Gitalk 2.0: компонент комментариев на базе GitHub Discussions. Сборки без фреймворка, для React и Vue.'
  },
  nav: {
    features: 'Возможности',
    usage: 'Использование',
    demo: 'Демо',
    theme: 'Сменить тему',
    language: 'Сменить язык',
    github: 'Репозиторий GitHub'
  },
  ambient: {
    aria: 'Фоновый звук: {season} · {state}',
    stateOn: 'вкл.',
    stateOff: 'выкл.',
    defaultTag: ' (по умолчанию)',
    hint: 'Нажмите, чтобы включить или выключить · правый клик или ← → — сезон · ↑ ↓ — громкость ({volume}%)',
    seasons: {
      spring: 'Весенний дождь',
      summer: 'Летние насекомые',
      autumn: 'Осенний огонь',
      winter: 'Зимний снег'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'Комментарии,',
    titleLine2: 'легче ',
    titleEm: 'одной строки',
    lede: 'Превратите GitHub Discussions или Issues в раздел комментариев. Разверните лёгкий прокси одной командой. Без базы данных, комментарии синхронизируются в реальном времени.',
    statsTitle: 'Ключевые цифры',
    stats: {
      lines: { value: '4', label: 'шага до подключения', note: 'Создать App, заполнить переменные, развернуть, подключить.' },
      comments: { value: '∞', label: 'Комментарии', note: 'Их хранит GitHub Discussions.' },
      size: { label: 'не самый маленький', note: 'Реальный объём передачи после gzip.' },
      deps: { value: '0', label: 'Зависимости', note: 'Слой отрисовки уже в сборке.' },
      stars: { label: 'Stars', note: 'Интерес сообщества на GitHub.' }
    },
    modeLabel: 'Режим макета', endpointLabel: 'Эндпоинт', modeDefault: 'По умолчанию', modeInline: 'Встроенный'
  },
  getStarted: {
    eyebrow: 'Подключение',
    title: 'Четыре шага до комментариев',
    lede: 'Три шага делаете вы — создаёте App, заполняете переменные, подключаете компонент, — а один шаг это команда. Порядок важен: третьему шагу нужны значения из второго.',
    steps: [
      {
        title: 'Создайте GitHub App',
        body: 'Settings → Developer settings → GitHub Apps. Выдайте Discussions: Read and write и Metadata: Read-only; в Callback URL укажите <адрес вашего прокси>/oauth/callback; Webhooks отключите (они не нужны).',
        code: ''
      },
      {
        title: 'Подготовьте переменные',
        body: 'Запишите App ID, Client ID, Client Secret и приватный ключ (содержимое .pem, а не отпечаток SHA256) в .env, а ключ сессии сгенерируйте через openssl rand -hex 32.',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: 'Разверните одной командой',
        body: 'CLI сначала проверяет все значения и называет недостающие, загружает учётные данные как secrets, разворачивает функцию, вызывает /health и выводит адрес, который нужно указать в proxy.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Подключите компонент',
        body: 'Укажите выведенный адрес в proxy — и комментарии работают. Стили, тёмная тема и переводы идут вместе с компонентом.',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase, самостоятельный хостинг и все переменные → README CLI развёртывания',
    domainTitle: 'Собственный домен',
    domainBody: 'Домен на Cloudflare привязывается напрямую; в другом месте нужно вручную добавить запись CNAME. Для собственного домена на CloudBase дополнительно нужна регистрация ICP. И то и другое делается вручную. Callback URL приложения тоже меняется только в веб-интерфейсе: приложения, принадлежащие организации, нельзя изменить через API.'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 — это переписанное ядро: Discussions по умолчанию, OAuth для записи и никаких секретов в браузере.',
    items: [
      {
        title: 'Discussions по умолчанию',
        body: 'Комментарии живут в Discussions, не засоряют список issues, а ошибка v1 с метками длиннее 50 символов исчезла.'
      },
      {
        title: 'Issues как опция',
        body: 'Существующие сайты могут указать backend: "issues" и сохранить данные — миграция возможна по одной странице.'
      },
      {
        title: 'Без фреймворка / React / Vue',
        body: 'Одно ядро, три способа использования. Каждая обёртка весит меньше 1 kB и не конфликтует с версией фреймворка в вашем проекте.'
      },
      {
        title: 'Секреты больше не утекают',
        body: 'В v1 clientSecret попадал на страницу и отправлялся стороннему прокси. В 2.0 используется edge function, которую вы разворачиваете сами: в браузере нет секретов.'
      },
      {
        title: 'Ноль зависимостей в рантайме',
        body: 'Слой отрисовки — только Preact. Даты через нативный Intl.RelativeTimeFormat, Markdown — HTML, отрендеренный GitHub.'
      },
      {
        title: 'Современный инструментарий',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · монорепозиторий pnpm · автовыпуски через release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'Как движутся данные',
    lede: 'Анонимное чтение, запись после входа. Это не упрощение: API GitHub не оставляет другого варианта.',
    anonTitle: 'Анонимные посетители',
    anonBadge: 'Без входа',
    anonPoints: [
      'Читает комментарии через REST API (60 запросов/час на IP)',
      'Получает HTML, отрендеренный GitHub',
      'Повторные запросы с ETag не расходуют лимит'
    ],
    authTitle: 'Вошедшие пользователи',
    authBadge: 'OAuth',
    authPoints: [
      'Комментирует, отвечает и ставит реакции через GraphQL',
      '5000 баллов/час, один балл за запрос',
      'token хранится в localStorage и отзывается в любой момент'
    ],
    note: 'Запись должна идти через GraphQL: у GitHub нет REST API записи для Discussions (маршрутов `POST` просто не существует). Анонимная квота GraphQL равна буквально `0`, поэтому «анонимное чтение + запись после входа» — единственная форма, которую навязывает архитектура, а не лень.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'Три способа использования',
    lede: 'Одно ядро — выберите точку входа, которая лучше подходит вашему проекту.',
    items: {
      vanilla: {
        label: 'Без фреймворка',
        hint: 'Один тег script и одна строка инициализации',
        code: `<!-- 1. Загрузите сборку -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. Контейнер -->
<div id="gitalk-container"></div>

<!-- 3. Инициализация -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // уникальный идентификатор страницы
    number: 42,              // номер существующего discussion (рекомендуется)
    backend: 'discussions',  // по умолчанию; старые сайты могут указать 'issues'
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
    note: 'Вход обязательно идёт через proxy: `github.com/login/oauth/access_token` не возвращает заголовки CORS, поэтому браузер не может сам завершить обмен token. Развёртывание — четыре шага выше; CloudBase и самостоятельный хостинг описаны в README репозитория.'
  },
  footer: {
    note: 'MIT · на базе GitHub Discussions',
    repo: 'Открыть репозиторий'
  }
}
