import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLayout } from './components/Layout/AppLayout'
import { ErrorBoundary } from './components/Layout/ErrorBoundary'
import { useStore } from './store/useStore'
import './index.css'

useStore.getState().restoreSession()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  </React.StrictMode>,
)
