import type { Messages } from '../i18n'

/** Polish. Typed against `zh`, the source locale. */
export const pl: Messages = {
  meta: {
    title: 'Gitalk 2.0 — komponent komentarzy oparty na GitHub Discussions',
    description:
      'Gitalk 2.0: komponent komentarzy oparty na GitHub Discussions. Wersje bez frameworka, dla React i Vue.'
  },
  nav: {
    features: 'Funkcje',
    usage: 'Sposób użycia',
    demo: 'Demo',
    theme: 'Zmień motyw',
    language: 'Zmień język',
    github: 'Repozytorium GitHub'
  },
  ambient: {
    aria: 'Dźwięk otoczenia: {season} · {state}',
    stateOn: 'włączony',
    stateOff: 'wyłączony',
    defaultTag: ' (domyślnie)',
    hint: 'Kliknij, aby przełączyć · prawy przycisk lub ← → zmienia porę roku · ↑ ↓ reguluje głośność ({volume}%)',
    seasons: {
      spring: 'Wiosenny deszcz',
      summer: 'Letnie owady',
      autumn: 'Jesienny ogień',
      winter: 'Zimowy śnieg'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'Komentarze,',
    titleLine2: 'lekkie jak ',
    titleEm: 'jedna linia',
    lede: 'Zamień GitHub Discussions lub Issues w sekcję komentarzy. Wdróż lekki proxy jednym poleceniem. Bez bazy danych, komentarze synchronizują się na bieżąco.',
    statsTitle: 'Najważniejsze liczby',
    stats: {
      lines: { value: '5', label: 'kroków', note: 'Utwórz App, wpisz wartości, wdróż, ustaw callback, podłącz.' },
      comments: { value: '∞', label: 'Komentarze', note: 'Przechowuje je GitHub Discussions.' },
      size: { label: 'nie najmniejszy', note: 'Rzeczywisty rozmiar transferu po gzip.' },
      deps: { value: '0', label: 'Zależności', note: 'Warstwa renderowania jest w pakiecie.' },
      stars: { label: 'Stars', note: 'Zainteresowanie społeczności na GitHubie.' }
    },
    modeLabel: 'Tryb układu', endpointLabel: 'Punkt końcowy', modeDefault: 'Domyślny', modeInline: 'Wbudowany'
  },
  getStarted: {
    eyebrow: 'Konfiguracja',
    title: 'Pięć kroków do komentarzy',
    lede: 'Cztery kroki są po Twojej stronie — utworzenie App, wpisanie wartości, ustawienie callbacku, podłączenie komponentu — a jeden to polecenie. Kolejność ma znaczenie: krok trzeci potrzebuje wartości z drugiego, a czwarty adresu wypisanego przez trzeci.',
    steps: [
      {
        title: 'Utwórz GitHub App',
        body: 'W Settings → Developer settings → GitHub Apps. Przyznaj Discussions: Read and write i Metadata: Read-only; pole Callback URL na razie zostaw puste — proxy powstaje dopiero w kroku trzecim, więc wrócisz do tego w kroku czwartym; Webhooks wyłącz (nie są używane).',
        code: ''
      },
      {
        title: 'Przygotuj zmienne',
        body: 'Zapisz App ID, Client ID, Client Secret i klucz prywatny (treść .pem, nie odcisk SHA256) w pliku .env, a klucz sesji wygeneruj przez openssl rand -hex 32. W GITALK_ALLOWED_ORIGINS wpisz domenę bloga — nie zależy od proxy, więc krok drugi może ją już uzupełnić.',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: 'Wdróż jednym poleceniem',
        body: 'CLI najpierw sprawdza wszystkie wartości i wskazuje brakujące, wysyła dane uwierzytelniające jako sekrety, wdraża, wywołuje /health i wypisuje adres, który wpisujesz w proxy. Zapisz ten adres — przyda się w kroku czwartym i piątym.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Wróć i ustaw callback URL',
        body: 'Wróć do ustawień App i wpisz w Callback URL adres z kroku trzeciego plus /oauth/callback. Pominięcie tego kończy się błędem redirect_uri_mismatch po kliknięciu „Zaloguj się”; zmiana działa od razu, bez ponownego wdrażania.',
        code: 'Callback URL: https://<adres twojego proxy>/oauth/callback'
      },
      {
        title: 'Podłącz komponent',
        body: 'Wpisz adres zapisany w kroku trzecim w proxy i komentarze działają. Styl, tryb ciemny i tłumaczenia dostarcza sam komponent.',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase, własny hosting i wszystkie zmienne → README CLI wdrożeniowego',
    domainTitle: 'Własne domeny',
    domainBody: 'Domenę w Cloudflare można podpiąć bezpośrednio; gdzie indziej trzeba ręcznie dodać rekord CNAME. Własna domena w CloudBase wymaga dodatkowo rejestracji ICP — jedno i drugie robi się ręcznie. Callback URL aplikacji też zmienia się tylko w interfejsie webowym (aplikacji należących do organizacji nie da się zmienić przez API).'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 to przepisany rdzeń: Discussions domyślnie, OAuth do zapisu i żadnych sekretów w przeglądarce.',
    items: [
      {
        title: 'Discussions domyślnie',
        body: 'Komentarze trafiają do Discussions, nie zaśmiecają listy issues, a błąd z v1 przy etykietach dłuższych niż 50 znaków znika.'
      },
      {
        title: 'Issues opcjonalnie',
        body: 'Istniejące strony mogą ustawić backend: "issues" i zachować swoje dane — migracja może iść strona po stronie.'
      },
      {
        title: 'Bez frameworka / React / Vue',
        body: 'Jeden rdzeń, trzy sposoby użycia. Każda otoczka waży mniej niż 1 kB i nie kłóci się z wersją frameworka w Twoim projekcie.'
      },
      {
        title: 'Koniec z wyciekiem sekretów',
        body: 'v1 wpisywał clientSecret w stronę i wysyłał go do obcego proxy. 2.0 używa edge function, którą wdrażasz sam — w przeglądarce nie ma sekretów.'
      },
      {
        title: 'Zero zależności w czasie działania',
        body: 'Warstwa renderowania to tylko Preact. Daty przez natywne Intl.RelativeTimeFormat, Markdown jako HTML wyrenderowany przez GitHub.'
      },
      {
        title: 'Nowoczesne narzędzia',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · monorepo pnpm · automatyczne wydania przez release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'Jak płyną dane',
    lede: 'Odczyt anonimowy, zapis po zalogowaniu. To nie skrót: API GitHuba nie pozostawia innego wyjścia.',
    anonTitle: 'Anonimowi odwiedzający',
    anonBadge: 'Bez logowania',
    anonPoints: [
      'Czyta komentarze przez REST API (60 żądań/godzinę na IP)',
      'Otrzymuje HTML wyrenderowany przez GitHub',
      'Powtórne żądania z ETag nie liczą się do limitu'
    ],
    authTitle: 'Zalogowani użytkownicy',
    authBadge: 'OAuth',
    authPoints: [
      'Komentuje, odpowiada i reaguje przez GraphQL',
      '5000 punktów/godzinę, jeden punkt za zapytanie',
      'token siedzi w localStorage i można go w każdej chwili unieważnić'
    ],
    note: 'Zapis musi iść przez GraphQL, bo GitHub nie udostępnia REST-owego API zapisu dla Discussions (trasy `POST` po prostu nie istnieją). Anonimowy limit GraphQL to dosłownie `0`, więc „anonimowy odczyt + zapis po zalogowaniu” to forma wymuszona przez architekturę, nie skrót.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'Trzy sposoby użycia',
    lede: 'Jeden rdzeń, trzy punkty wejścia. Wybierz ten, który najlepiej pasuje do Twojego projektu.',
    items: {
      vanilla: {
        label: 'Bez frameworka',
        hint: 'Jeden tag script i jedna linia inicjalizacji',
        code: `<!-- 1. Wczytaj pakiet -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. Kontener -->
<div id="gitalk-container"></div>

<!-- 3. Inicjalizacja -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // unikalny identyfikator strony
    number: 42,              // numer istniejącej discussion (zalecane)
    backend: 'discussions',  // domyślnie; strony v1 mogą podać 'issues'
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
    note: 'Logowanie musi przechodzić przez proxy: `github.com/login/oauth/access_token` nie zwraca nagłówków CORS, więc przeglądarka sama nie dokończy wymiany tokenu. Wdrożenie to pięć kroków powyżej; CloudBase i własny hosting opisuje README repozytorium.'
  },
  footer: {
    note: 'MIT · na bazie GitHub Discussions',
    repo: 'Zobacz repozytorium'
  }
}
