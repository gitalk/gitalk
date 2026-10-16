import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { I18nProvider } from './i18n'
import '@aifire/gitalk/style.css'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
)
