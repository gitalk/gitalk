import type { Messages } from '../i18n'
import { CDN_SCRIPT } from '../snippets'

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
    faq: 'FAQ',
    v1Title: 'L’ancien site Gitalk 1.x',
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
      lines: { value: '5', label: 'étapes', note: 'Préparer le dépôt, créer l’App, déployer, installer, intégrer.' },
      comments: { value: '∞', label: 'Commentaires', note: 'Portés par GitHub Discussions.' },
      size: { label: 'pas le plus petit', note: 'Taille réelle transférée après gzip.' },
      deps: { value: '0', label: 'Dépendances', note: 'La couche de rendu est incluse dans le bundle.' },
      stars: { label: 'Stars', note: 'Intérêt de la communauté sur GitHub.' }
    },
    modeLabel: 'Mode d’affichage', endpointLabel: 'Point de terminaison', modeDefault: 'Par défaut', modeInline: 'En ligne'
  },
  getStarted: {
    eyebrow: 'Mise en place',
    title: 'Cinq étapes pour vos commentaires',
    lede: 'L’ordre compte : préparez le dépôt, créez l’App, déployez le proxy et réglez l’URL de callback, installez l’App sur le dépôt, puis intégrez le composant. Chaque étape n’a qu’un seul guide complet.',
    steps: [
      {
        title: 'Préparer le dépôt',
        body: 'Il doit être public, avec Discussions activé (Settings → General → Features → Discussions) et au moins une catégorie.',
        code: ''
      },
      {
        title: 'Créer la GitHub App',
        body: 'Seuls Discussions: Read and write et Metadata: Read-only sont nécessaires.',
        code: ''
      },
      {
        title: 'Déployer le proxy, puis régler l’URL de callback',
        body: 'Une commande le déploie. Attendez l’adresse affichée, puis mettez Callback URL sur <adresse>/oauth/callback.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Installer l’App sur le dépôt',
        body: 'La créer ne suffit pas : ouvrez github.com/apps/my-niubi-gitalk/installations/new et cochez le dépôt des commentaires, demo-repo. Sans installation, le proxy n’obtient aucun jeton et les lectures anonymes retombent à 60 par heure.',
        code: ''
      },
      {
        title: 'Intégrer le composant',
        body: 'Passez clientID, owner, repo, admin, number et le proxy affiché (exemple : owner octocat, repo demo-repo).',
        code: ''
      }
    ],
    more: 'Étapes complètes — identifiants, .env, CloudBase, toutes les variables → README de la CLI de déploiement',
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
    note: 'La connexion passe obligatoirement par un proxy : `github.com/login/oauth/access_token` n’envoie pas d’en-têtes CORS, le navigateur ne peut donc pas terminer l’échange du token seul. Le déploiement correspond aux cinq étapes ci-dessus ; CloudBase et l’auto-hébergement sont couverts par le README du dépôt.'
  },
  faq: {
    eyebrow: '// FAQ',
    title: 'Questions fréquentes',
    items: [
      {
        q: 'Peut-on le charger directement depuis un CDN ?',
        a: 'Le composant, oui. Mais la connexion et la publication de commentaires ne peuvent pas partager le proxy officiel : il n’autorise que les sites du projet lui-même et tourne sur l’App du projet. Votre site a besoin de son propre déploiement (une commande, cinq minutes environ).',
        code: CDN_SCRIPT
      },
      {
        q: 'Faut-il déployer un proxy ?',
        a: 'Pas pour lire les commentaires : le navigateur appelle directement l’API REST de GitHub, dans la limite anonyme de 60 requêtes par heure. Il en faut un pour se connecter, commenter et réagir, car le point de terminaison de jeton de GitHub ne renvoie pas d’en-têtes CORS.',
        code: ''
      },
      {
        q: 'Où sont stockées les données ?',
        a: 'Dans votre propre dépôt : Discussions ou Issues. Aucun serveur intermédiaire, et vous pouvez exporter ou migrer depuis GitHub à tout moment.',
        code: ''
      },
      {
        q: 'Comment migrer depuis la v1 ?',
        a: "Remplacer `clientID` et ajouter `proxy` suffit. Les sites existants peuvent définir `backend: 'issues'` pour garder leur Issue d’origine, sans migrer de données.",
        code: ''
      },
      {
        q: 'Pourquoi le nom d’utilisateur s’affiche-t-il au lieu du pseudo ?',
        a: 'Le pseudo GitHub (display name) s’affiche par défaut ; ceux qui n’en ont pas montrent leur nom d’utilisateur. Les mentions `@` utilisent toujours le nom d’utilisateur : GitHub ne sait pas résoudre un pseudo.',
        code: ''
      },
      {
        q: 'Quels frameworks sont pris en charge ?',
        a: 'Sans framework (un `<div>` et un constructeur), React et Vue. Styles, mode sombre et 11 langues (dont le persan en RTL) sont fournis avec le composant.',
        code: ''
      },
      {
        q: 'Est-ce gratuit ?',
        a: 'Le composant est sous MIT. Le proxy tient dans le quota gratuit de chaque plateforme pour la plupart des sites : pas de coût de serveur, pas d’offre payante.',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · propulsé par GitHub Discussions',
    repo: 'Voir le dépôt'
  }
}
