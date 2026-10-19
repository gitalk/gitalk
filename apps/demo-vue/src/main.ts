import { createApp } from 'vue'
import '@aifire/gitalk/style.css'
import './style.css'
import App from './app.vue'

const media = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => {
  document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
}

applyTheme()
media.addEventListener('change', applyTheme)

createApp(App).mount('#app')
