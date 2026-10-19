import { createRoot } from 'react-dom/client'
import '@aifire/gitalk/style.css'
import './style.css'
import { App } from './app'

const media = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => {
  document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
}

applyTheme()
media.addEventListener('change', applyTheme)

createRoot(document.getElementById('root')!).render(<App />)
