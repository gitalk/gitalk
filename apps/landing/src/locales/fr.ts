import type { Messages } from '../i18n'

/** French. Typed against `zh`, the source locale. */
export const fr: Messages = {
  meta: {
    title: 'Gitalk 2.0 — un composant de commentaires basé sur GitHub Discussions',
    description:
      'Gitalk 2.0 : un composant de commentaires basé sur GitHub Discussions. Builds sans framework, React et Vue.'
  },
  nav: {
    features: 'Fonctionnalités',
    usage: 'Utilisation',
    demo: 'Démo',
    theme: 'Changer de thème',
    language: 'Changer de langue',
    github: 'Dépôt GitHub'
  },
  ambient: {
    aria: 'Ambiance : {season} · {state}',
    stateOn: 'activée',
    stateOff: 'désactivée',
    defaultTag: ' (par défaut)',
    hint: 'Cliquer pour activer ou désactiver · clic droit ou ← → pour la saison · ↑ ↓ pour le volume ({volume} %)',
    seasons: {
      spring: 'Pluie de printemps',
      summer: 'Insectes d’été',
      autumn: 'Feu d’automne',
      winter: 'Neige d’hiver'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'Des commentaires,',
    titleLine2: 'légers comme ',
    titleEm: 'une ligne',
    lede: 'Transformez GitHub Discussions ou Issues en section de commentaires. Déployez un proxy léger avec une seule commande. Pas de base de données, et les commentaires se synchronisent en direct.',
    statsTitle: 'Chiffres clés',
    stats: {
      lines: { value: '5', label: 'étapes', note: 'Créer l’App, renseigner les valeurs, déployer, définir le callback, intégrer.' },
      comments: { value: '∞', label: 'Commentaires', note: 'Portés par GitHub Discussions.' },
      size: { label: 'pas le plus petit', note: 'Taille réelle transférée après gzip.' },
      deps: { value: '0', label: 'Dépendances', note: 'La couche de rendu est incluse dans le bundle.' },
      stars: { label: 'Stars', note: 'Intérêt de la communauté sur GitHub.' }
    },
    modeLabel: 'Mode d’affichage', endpointLabel: 'Point de terminaison', modeDefault: 'Par défaut', modeInline: 'En ligne'
  },
  getStarted: {
    eyebrow: 'Mise en place',
    title: 'Quatre étapes vers les commentaires',
    lede: 'Trois sont à votre charge — créer l’App, renseigner les valeurs, intégrer le composant — et une est une commande. L’ordre compte : l’étape trois a besoin des valeurs de l’étape deux.',
    steps: [
      {
        title: 'Créer une GitHub App',
        body: 'Dans Settings → Developer settings → GitHub Apps. Accordez Discussions: Read and write et Metadata: Read-only ; mettez <votre proxy>/oauth/callback comme Callback URL et désactivez les Webhooks (inutiles).',
        code: ''
      },
      {
        title: 'Préparer les variables',
        body: 'Placez l’App ID, le Client ID, le Client Secret et la clé privée (le contenu du .pem, pas l’empreinte SHA256) dans un .env, et générez une clé de session avec openssl rand -hex 32.',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: 'Déployer en une commande',
        body: 'La CLI vérifie d’abord toutes les valeurs et nomme celles qui manquent, téléverse les identifiants comme secrets, déploie, appelle /health puis affiche l’URL à utiliser comme proxy.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Intégrer le composant',
        body: 'Passez l’URL affichée comme proxy et les commentaires fonctionnent. Styles, mode sombre et traductions sont fournis par le composant.',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase, auto-hébergement et toutes les variables → README de la CLI de déploiement',
    domainTitle: 'Domaines personnalisés',
    domainBody: 'Un domaine hébergé chez Cloudflare se lie directement ; ailleurs, il faut ajouter un enregistrement CNAME à la main. CloudBase exige en plus un enregistrement ICP. L’URL de callback de l’App ne se modifie que dans l’interface web : les Apps appartenant à une organisation ne sont pas modifiables par API.'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 réécrit le cœur : Discussions par défaut, OAuth pour écrire, et aucun secret dans le navigateur.',
    items: [
      {
        title: 'Discussions par défaut',
        body: 'Les commentaires vivent dans Discussions : ils n’encombrent pas la liste des issues, et le bug de la v1 avec les labels de plus de 50 caractères disparaît.'
      },
      {
        title: 'Issues en option',
        body: 'Les sites existants peuvent mettre backend: "issues" et garder leurs données ; la migration peut se faire page par page.'
      },
      {
        title: 'Sans framework / React / Vue',
        body: 'Un seul cœur, trois usages. Chaque enveloppe fait moins de 1 kB et n’entre pas en conflit avec la version du framework de votre projet.'
      },
      {
        title: 'Plus de secrets exposés',
        body: 'La v1 mettait clientSecret dans la page et l’envoyait à un proxy tiers. 2.0 utilise une edge function que vous déployez : aucun secret dans le navigateur.'
      },
      {
        title: 'Zéro dépendance à l’exécution',
        body: 'La couche de rendu, c’est Preact uniquement. Les dates passent par Intl.RelativeTimeFormat natif, le Markdown par le HTML rendu par GitHub.'
      },
      {
        title: 'Outillage moderne',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · monorepo pnpm · versions automatisées par release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'Comment circulent les données',
    lede: 'Lecture anonyme, écriture connectée. Ce n’est pas un raccourci : les API de GitHub n’en laissent pas d’autre.',
    anonTitle: 'Visiteurs anonymes',
    anonBadge: 'Sans connexion',
    anonPoints: [
      'Lit les commentaires via l’API REST (60 requêtes/heure par IP)',
      'Reçoit directement le HTML rendu par GitHub',
      'Les requêtes répétées avec un ETag ne comptent pas dans la limite'
    ],
    authTitle: 'Utilisateurs connectés',
    authBadge: 'OAuth',
    authPoints: [
      'Commente, répond et réagit via GraphQL',
      '5 000 points/heure ; un point par requête',
      'Le token reste dans localStorage et peut être révoqué à tout moment'
    ],
    note: 'Les écritures doivent passer par GraphQL, car GitHub n’expose pas d’API REST d’écriture pour Discussions (les routes `POST` n’existent pas). Le quota anonyme de GraphQL vaut littéralement `0` : « lecture anonyme + écriture connectée » est donc la forme imposée par l’architecture, pas un raccourci.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'Trois façons de l’utiliser',
    lede: 'Un seul cœur, trois points d’entrée. Prenez celui qui convient le mieux à votre projet.',
    items: {
      vanilla: {
        label: 'Sans framework',
        hint: 'Une balise script et une ligne d’initialisation',
        code: `<!-- 1. Charge le build -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. Conteneur -->
<div id="gitalk-container"></div>

<!-- 3. Initialise -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // identifiant unique de la page
    number: 42,              // numéro de la discussion existante (recommandé)
    backend: 'discussions',  // par défaut ; les sites v1 peuvent passer 'issues'
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
    note: 'La connexion passe obligatoirement par un proxy : `github.com/login/oauth/access_token` n’envoie pas d’en-têtes CORS, le navigateur ne peut donc pas terminer l’échange du token seul. Le déploiement correspond aux quatre étapes ci-dessus ; CloudBase et l’auto-hébergement sont couverts par le README du dépôt.'
  },
  footer: {
    note: 'MIT · propulsé par GitHub Discussions',
    repo: 'Voir le dépôt'
  }
}
