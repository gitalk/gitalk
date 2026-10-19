import type { Messages } from '../i18n'
import { CDN_SCRIPT } from '../snippets'

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
    faq: 'FAQ',
    v1Title: 'Сайт Gitalk 1.x',
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
      lines: { value: '4', label: 'шагов до подключения', note: 'Подготовить репозиторий, создать и установить App, развернуть, вставить.' },
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
    lede: 'Порядок важен: подготовьте репозиторий, создайте App и установите её в этот репозиторий, разверните proxy и задайте callback URL, затем вставьте компонент. У каждого шага одно полное описание.',
    steps: [
      {
        title: 'Подготовьте репозиторий',
        body: 'Он должен быть public, с включёнными Discussions (Settings → General → Features → Discussions) и хотя бы одной категорией.',
        code: ''
      },
      {
        title: 'Создайте GitHub App и установите её в репозиторий',
        body: 'Нужны только Discussions: Read and write и Metadata: Read-only. ⚠️ Создать недостаточно: без установки proxy не получит installation token, и анонимные чтения упадут до 60 запросов в час.',
        code: ''
      },
      {
        title: 'Разверните proxy и задайте callback URL',
        body: 'Одна команда разворачивает его. Дождитесь выведенного адреса и укажите в Callback URL <адрес>/oauth/callback.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Вставьте компонент',
        body: 'Передайте clientID, owner, repo, admin, number и выведенный proxy.',
        code: ''
      }
    ],
    more: 'Полные шаги — учётные данные, .env, CloudBase, все переменные → README CLI развёртывания',
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
  faq: {
    eyebrow: '// FAQ',
    title: 'Частые вопросы',
    items: [
      {
        q: 'Можно ли просто подключить его с CDN?',
        a: 'Сам компонент — да. Но вход и отправка комментариев не могут использовать общий официальный proxy: он пропускает только сайты самого проекта и работает на собственном App проекта. Вашему сайту нужен свой деплой (одна команда, около пяти минут).',
        code: CDN_SCRIPT
      },
      {
        q: 'Обязательно ли разворачивать proxy?',
        a: 'Для чтения комментариев — нет: браузер обращается к GitHub REST напрямую, анонимный лимит — 60 запросов в час. Он нужен для входа, отправки комментариев и reaction, потому что эндпоинт токенов GitHub не возвращает заголовки CORS.',
        code: ''
      },
      {
        q: 'Где хранятся данные?',
        a: 'В вашем собственном репозитории — Discussions или Issues. Промежуточного сервера нет, экспортировать или перенести данные можно в GitHub в любой момент.',
        code: ''
      },
      {
        q: 'Как перейти с v1?',
        a: "Достаточно заменить `clientID` и добавить `proxy`. Старые сайты могут указать `backend: 'issues'` и продолжить использовать прежний Issue — переносить данные не нужно.",
        code: ''
      },
      {
        q: 'Почему показывается имя пользователя, а не ник?',
        a: 'По умолчанию показывается ник (GitHub display name), а у тех, кто его не задал, — имя пользователя. Упоминания через `@` всегда используют имя пользователя: ник GitHub не разрешает.',
        code: ''
      },
      {
        q: 'Какие фреймворки поддерживаются?',
        a: 'Без фреймворка (один `<div>` и один конструктор), React и Vue. Стили, тёмная тема и 11 языков (включая персидский RTL) идут вместе с компонентом.',
        code: ''
      },
      {
        q: 'Это бесплатно?',
        a: 'Компонент — MIT. Proxy укладывается в бесплатные квоты платформ для большинства сайтов: ни расходов на сервер, ни платных тарифов.',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · на базе GitHub Discussions',
    repo: 'Открыть репозиторий'
  }
}
