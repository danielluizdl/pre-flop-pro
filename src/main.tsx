import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/Layout/AppLayout'
import { ErrorBoundary } from './components/Layout/ErrorBoundary'
import { useStore } from './store/useStore'
import { initSentry } from './utils/sentry'
import './index.css'

initSentry()
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
