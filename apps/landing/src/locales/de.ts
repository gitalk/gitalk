import type { Messages } from '../i18n'
import { CDN_SCRIPT } from '../snippets'

/** German. Typed against `zh`, the source locale. */
export const de: Messages = {
  meta: {
    title: 'Gitalk 2.0 — eine Kommentarkomponente auf Basis von GitHub Discussions',
    description:
      'Gitalk 2.0: eine Kommentarkomponente auf Basis von GitHub Discussions. Builds ohne Framework, für React und Vue.'
  },
  nav: {
    features: 'Funktionen',
    usage: 'Verwendung',
    demo: 'Demo',
    faq: 'FAQ',
    v1Title: 'Die Gitalk-1.x-Seite',
    theme: 'Design wechseln',
    language: 'Sprache wechseln',
    github: 'GitHub-Repository'
  },
  ambient: {
    aria: 'Klangkulisse: {season} · {state}',
    stateOn: 'an',
    stateOff: 'aus',
    defaultTag: ' (Standard)',
    hint: 'Klicken zum Umschalten · Rechtsklick oder ← → für die Jahreszeit · ↑ ↓ für die Lautstärke ({volume} %)',
    seasons: {
      spring: 'Frühlingsregen',
      summer: 'Sommerinsekten',
      autumn: 'Herbstfeuer',
      winter: 'Winterschnee'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'Kommentare,',
    titleLine2: 'leicht wie ',
    titleEm: 'eine Zeile',
    lede: 'Machen Sie GitHub Discussions oder Issues zu Ihrer Kommentarsektion. Ein Befehl deployt einen schlanken Proxy. Keine Datenbank, Kommentare synchronisieren in Echtzeit.',
    statsTitle: 'Kennzahlen',
    stats: {
      lines: { value: '5', label: 'Schritte', note: 'Repository vorbereiten, App anlegen, deployen, installieren, einbinden.' },
      comments: { value: '∞', label: 'Kommentare', note: 'Getragen von GitHub Discussions.' },
      size: { label: 'nicht die kleinste', note: 'Tatsächliche Übertragungsgröße nach gzip.' },
      deps: { value: '0', label: 'Laufzeitabhängigkeiten', note: 'Die Rendering-Schicht steckt im Bundle.' },
      stars: { label: 'Stars', note: 'Interesse der Community auf GitHub.' }
    },
    modeLabel: 'Layout-Modus', endpointLabel: 'Endpunkt', modeDefault: 'Standard', modeInline: 'Inline'
  },
  getStarted: {
    eyebrow: 'Einrichtung',
    title: 'Fünf Schritte zu Kommentaren',
    lede: 'Die Reihenfolge zählt: Repository vorbereiten, App anlegen, Proxy deployen und Callback-URL setzen, App im Repository installieren, Komponente einbinden. Für jeden Schritt gibt es genau eine vollständige Anleitung.',
    steps: [
      {
        title: 'Repository vorbereiten',
        body: 'Es muss public sein, Discussions aktiviert haben (Settings → General → Features → Discussions) und mindestens eine Kategorie besitzen.',
        code: ''
      },
      {
        title: 'GitHub App anlegen',
        body: 'Nötig sind nur Discussions: Read and write und Metadata: Read-only.',
        code: ''
      },
      {
        title: 'Proxy deployen, dann Callback-URL setzen',
        body: 'Ein Befehl deployt ihn. Warten Sie auf die ausgegebene Adresse und tragen Sie dann als Callback URL <Adresse>/oauth/callback ein.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'App im Repository installieren',
        body: 'Anlegen genügt nicht: Öffnen Sie github.com/apps/my-niubi-gitalk/installations/new und wählen Sie das Repository mit den Kommentaren, demo-repo. Ohne Installation erhält der Proxy kein Installation-Token, und anonyme Lesezugriffe fallen auf 60 pro Stunde zurück.',
        code: ''
      },
      {
        title: 'Komponente einbinden',
        body: 'clientID, owner, repo, admin, number und den ausgegebenen proxy übergeben (Beispiel: owner octocat, repo demo-repo).',
        code: ''
      }
    ],
    more: 'Vollständige Schritte — Zugangsdaten, .env, CloudBase, alle Variablen → README der Deploy-CLI',
    domainTitle: 'Eigene Domains',
    domainBody: 'Eine Domain bei Cloudflare lässt sich direkt verbinden; anderswo muss ein CNAME-Eintrag von Hand angelegt werden. Bei CloudBase kommt zusätzlich eine ICP-Registrierung hinzu — beides ist Handarbeit. Die Callback-URL der App lässt sich nur in der Weboberfläche ändern (Apps einer Organisation nicht per API).'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 schreibt den Kern neu: Discussions als Standard, OAuth fürs Schreiben, kein Secret mehr im Browser.',
    items: [
      {
        title: 'Discussions als Standard',
        body: 'Kommentare liegen in Discussions, verstopfen nicht die Issue-Liste, und der v1-Fehler bei Labels über 50 Zeichen ist weg.'
      },
      {
        title: 'Issues optional',
        body: 'Bestehende Seiten setzen backend: "issues" und behalten ihre Daten — die Migration kann Seite für Seite erfolgen.'
      },
      {
        title: 'Ohne Framework / React / Vue',
        body: 'Ein Kern, drei Verwendungen. Jeder Wrapper bleibt unter 1 kB und gerät nicht mit der Framework-Version Ihres Projekts aneinander.'
      },
      {
        title: 'Keine Secrets im Browser',
        body: 'v1 schrieb clientSecret in die Seite und schickte es an einen fremden Proxy. 2.0 nutzt eine Edge Function, die Sie selbst deployen — kein Secret im Browser.'
      },
      {
        title: 'Null Laufzeitabhängigkeiten',
        body: 'Die Rendering-Schicht ist nur Preact. Datumsangaben über das native Intl.RelativeTimeFormat, Markdown als von GitHub gerendertes HTML.'
      },
      {
        title: 'Moderne Toolchain',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm-Monorepo · automatische Releases mit release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'Wie die Daten fließen',
    lede: 'Anonym lesen, angemeldet schreiben. Das ist keine Abkürzung: GitHubs APIs lassen keine andere Wahl.',
    anonTitle: 'Anonyme Besucher',
    anonBadge: 'Ohne Anmeldung',
    anonPoints: [
      'Liest Kommentare über die REST-API (60 Anfragen/Stunde pro IP)',
      'Erhält das von GitHub gerenderte HTML direkt',
      'Wiederholte Anfragen mit ETag zählen nicht ins Limit'
    ],
    authTitle: 'Angemeldete Nutzer',
    authBadge: 'OAuth',
    authPoints: [
      'Kommentiert, antwortet und reagiert über GraphQL',
      '5.000 Punkte/Stunde, ein Punkt pro Query',
      'Das Token liegt in localStorage und lässt sich jederzeit widerrufen'
    ],
    note: 'Schreibvorgänge müssen über GraphQL laufen, denn GitHub bietet keine REST-Schreib-API für Discussions (die `POST`-Routen existieren schlicht nicht). Das anonyme GraphQL-Kontingent beträgt buchstäblich `0`; „anonym lesen + angemeldet schreiben“ erzwingt die Architektur, es ist keine Abkürzung.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'Drei Arten der Verwendung',
    lede: 'Ein Kern, drei Einstiegspunkte. Nehmen Sie den, der zu Ihrem Projekt passt.',
    items: {
      vanilla: {
        label: 'Ohne Framework',
        hint: 'Ein script-Tag und eine Zeile Initialisierung',
        code: `<!-- 1. Build laden -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. Container -->
<div id="gitalk-container"></div>

<!-- 3. Initialisieren -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // eindeutige Seitenkennung
    number: 42,              // Nummer der vorhandenen discussion (empfohlen)
    backend: 'discussions',  // Standard; v1-Seiten können 'issues' übergeben
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
    note: 'Die Anmeldung muss über einen Proxy laufen: `github.com/login/oauth/access_token` sendet keine CORS-Header, der Browser kann den Token-Tausch nicht allein abschließen. Das Deployment sind die fünf Schritte oben; CloudBase und Selbsthosting stehen im README des Repositories.'
  },
  faq: {
    eyebrow: '// FAQ',
    title: 'Häufige Fragen',
    items: [
      {
        q: 'Lässt es sich direkt per CDN einbinden?',
        a: 'Die Komponente selbst schon. Anmeldung und Kommentare können sich aber nicht den offiziellen Proxy teilen: Er lässt nur die eigenen Seiten dieses Projekts zu und läuft auf der App des Projekts. Deine Seite braucht ein eigenes Deployment (ein Befehl, etwa fünf Minuten).',
        code: CDN_SCRIPT
      },
      {
        q: 'Muss ich einen Proxy deployen?',
        a: 'Zum reinen Lesen nicht: Der Browser spricht direkt mit der GitHub-REST-API, anonym 60 Anfragen pro Stunde. Für Anmeldung, Kommentare und reaction ist er nötig, weil GitHubs Token-Endpunkt keine CORS-Header zurückgibt.',
        code: ''
      },
      {
        q: 'Wo liegen die Daten?',
        a: 'In deinem eigenen Repository — Discussions oder Issues. Kein Zwischenserver, und du kannst jederzeit in GitHub exportieren oder migrieren.',
        code: ''
      },
      {
        q: 'Wie migriere ich von v1?',
        a: "`clientID` austauschen und `proxy` ergänzen reicht. Bestehende Seiten setzen `backend: 'issues'` und nutzen ihr bisheriges Issue weiter — ohne Datenmigration.",
        code: ''
      },
      {
        q: 'Warum steht dort der Benutzername statt des Anzeigenamens?',
        a: 'Standardmäßig wird der GitHub-Anzeigename gezeigt, ohne einen solchen der Benutzername. `@`-Erwähnungen nutzen immer den Benutzernamen — GitHub kann Anzeigenamen nicht auflösen.',
        code: ''
      },
      {
        q: 'Welche Frameworks werden unterstützt?',
        a: 'Ohne Framework (ein `<div>` und ein Konstruktor), React und Vue. Styles, Dark Mode und 11 Sprachen (inklusive Persisch mit RTL) bringt die Komponente mit.',
        code: ''
      },
      {
        q: 'Ist es kostenlos?',
        a: 'Die Komponente ist MIT. Der Proxy passt für die meisten Seiten in die kostenlosen Kontingente der Plattformen: keine Serverkosten, kein Bezahlplan.',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · auf Basis von GitHub Discussions',
    repo: 'Repository ansehen'
  }
}
