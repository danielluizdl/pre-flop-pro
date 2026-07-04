import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/Layout/AppLayout'
import { ErrorBoundary } from './components/Layout/ErrorBoundary'
import { useStore } from './store/useStore'
import { setLangDict } from './i18n'
import { initSentry } from './utils/sentry'
import './index.css'

initSentry()
// Garante que o dicionário ativo case com o idioma persistido antes do 1º render
// (complementa o onRehydrateStorage do persist).
setLangDict(useStore.getState().lang)
// Aplica o tema antes do 1º paint (o AppLayout mantém sincronizado depois).
document.documentElement.classList.toggle('dark', useStore.getState().darkMode)
useStore.getState().restoreSession()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
