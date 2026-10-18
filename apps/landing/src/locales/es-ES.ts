import type { Messages } from '../i18n'

/** Spanish (Spain). Typed against `zh`, the source locale. */
export const esES: Messages = {
  meta: {
    title: 'Gitalk 2.0 — Un componente de comentarios basado en GitHub Discussions',
    description:
      'Gitalk 2.0: un componente de comentarios basado en GitHub Discussions. Builds sin framework, React y Vue.'
  },
  nav: {
    features: 'Características',
    usage: 'Uso',
    demo: 'Demo',
    theme: 'Cambiar tema',
    language: 'Cambiar idioma',
    github: 'Repositorio de GitHub'
  },
  ambient: {
    aria: 'Sonido ambiente: {season} · {state}',
    stateOn: 'activado',
    stateOff: 'desactivado',
    defaultTag: ' (predeterminado)',
    hint: 'Clic para activar o desactivar · clic derecho o ← → para la estación · ↑ ↓ para el volumen ({volume}%)',
    seasons: {
      spring: 'Lluvia de primavera',
      summer: 'Insectos de verano',
      autumn: 'Fuego de otoño',
      winter: 'Nieve de invierno'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'Comentarios,',
    titleLine2: 'ligeros como ',
    titleEm: 'una línea',
    lede: 'Convierte GitHub Discussions o Issues en tu sección de comentarios. Despliega un proxy ligero con un solo comando. Sin base de datos y con comentarios sincronizados al instante.',
    statsTitle: 'Cifras clave',
    stats: {
      lines: { value: '5', label: 'pasos', note: 'Crear la App, rellenar los valores, desplegar, fijar el callback e incluir.' },
      comments: { value: '∞', label: 'Comentarios', note: 'Los aloja GitHub Discussions.' },
      size: { label: 'no es el más pequeño', note: 'Tamaño real transferido tras gzip.' },
      deps: { value: '0', label: 'Dependencias', note: 'La capa de renderizado va en el bundle.' },
      stars: { label: 'Stars', note: 'Interés de la comunidad en GitHub.' }
    },
    modeLabel: 'Modo de diseño', endpointLabel: 'Endpoint', modeDefault: 'Predeterminado', modeInline: 'En línea'
  },
  getStarted: {
    eyebrow: 'Configuración',
    title: 'Cuatro pasos para tener comentarios',
    lede: 'Tres los haces tú —crear la App, rellenar los valores, incluir el componente— y uno es un comando. El orden importa: el paso tres necesita los valores del paso dos.',
    steps: [
      {
        title: 'Crea una GitHub App',
        body: 'En Settings → Developer settings → GitHub Apps. Concede Discussions: Read and write y Metadata: Read-only; pon <tu proxy>/oauth/callback como Callback URL y desactiva los Webhooks (no se usan).',
        code: ''
      },
      {
        title: 'Prepara las variables',
        body: 'Escribe el App ID, el Client ID, el Client Secret y la clave privada (el contenido del .pem, no la huella SHA256) en un .env, y genera una clave de sesión con openssl rand -hex 32.',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: 'Despliega con un comando',
        body: 'La CLI comprueba primero todos los valores y nombra los que falten, sube las credenciales como secretos, despliega, llama a /health y muestra la URL que debes usar como proxy.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Incluye el componente',
        body: 'Pasa la URL mostrada como proxy y los comentarios funcionan. Los estilos, el modo oscuro y los idiomas vienen con el componente.',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase, autohospedaje y todas las variables → README de la CLI de despliegue',
    domainTitle: 'Dominios personalizados',
    domainBody: 'Un dominio en Cloudflare se puede vincular directamente; en cualquier otro sitio hay que añadir un registro CNAME a mano. CloudBase además exige registro ICP. La URL de callback de la App solo se edita en la interfaz web: las Apps de una organización no se pueden cambiar por API.'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 reescribe el núcleo: Discussions por defecto, OAuth para escribir y ningún secreto en el navegador.',
    items: [
      {
        title: 'Discussions por defecto',
        body: 'Los comentarios viven en Discussions, así que no ensucian la lista de issues, y el fallo de v1 con etiquetas de más de 50 caracteres desaparece.'
      },
      {
        title: 'Issues como opción',
        body: 'Los sitios existentes pueden poner backend: "issues" y conservar sus datos, de modo que la migración puede ir página a página.'
      },
      {
        title: 'Sin framework / React / Vue',
        body: 'Un núcleo, tres formas de usarlo. Cada envoltorio pesa menos de 1 kB y no choca con la versión del framework de tu proyecto.'
      },
      {
        title: 'Sin secretos filtrados',
        body: 'v1 metía clientSecret en la página y lo enviaba a un proxy de terceros. 2.0 usa una edge function que despliegas tú: no hay secretos en el navegador.'
      },
      {
        title: 'Cero dependencias en tiempo de ejecución',
        body: 'La capa de renderizado es solo Preact. Las fechas usan Intl.RelativeTimeFormat nativo y el Markdown llega como HTML renderizado por GitHub.'
      },
      {
        title: 'Herramientas modernas',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · monorepo con pnpm · versiones automáticas con release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'Cómo fluyen los datos',
    lede: 'Lectura anónima, escritura con sesión. No es un atajo: las APIs de GitHub no dejan otra opción.',
    anonTitle: 'Visitantes anónimos',
    anonBadge: 'Sin iniciar sesión',
    anonPoints: [
      'Lee los comentarios por la API REST (60 peticiones/hora por IP)',
      'Recibe el HTML que GitHub ya renderizó',
      'Las peticiones repetidas con ETag no cuentan para el límite'
    ],
    authTitle: 'Usuarios con sesión',
    authBadge: 'OAuth',
    authPoints: [
      'Comenta, responde y reacciona por GraphQL',
      '5000 puntos/hora; un punto por consulta',
      'El token vive en localStorage y se puede revocar en cualquier momento'
    ],
    note: 'Las escrituras deben ir por GraphQL, porque GitHub no expone una API REST de escritura para Discussions (las rutas `POST` no existen). La cuota anónima de GraphQL es literalmente `0`, así que «lectura anónima + escritura con sesión» es lo que impone la arquitectura, no un atajo.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'Tres formas de usarlo',
    lede: 'Un núcleo, tres puntos de entrada. Elige el que mejor encaje con tu proyecto.',
    items: {
      vanilla: {
        label: 'Sin framework',
        hint: 'Una etiqueta script y una línea de inicialización',
        code: `<!-- 1. Carga el build -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. Contenedor -->
<div id="gitalk-container"></div>

<!-- 3. Inicializa -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // identificador único de la página
    number: 42,              // número de la discussion existente (recomendado)
    backend: 'discussions',  // predeterminado; los sitios v1 pueden pasar 'issues'
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
    note: 'El inicio de sesión debe pasar por un proxy: `github.com/login/oauth/access_token` no envía cabeceras CORS, así que el navegador no puede completar el intercambio del token por sí solo. Para desplegarlo, sigue los cuatro pasos de arriba; CloudBase y el autohospedaje están en el README del repositorio.'
  },
  footer: {
    note: 'MIT · con GitHub Discussions',
    repo: 'Ver repositorio'
  }
}
