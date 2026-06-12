import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLayout } from './components/Layout/AppLayout'
import { ErrorBoundary } from './components/Layout/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  </React.StrictMode>,
)
