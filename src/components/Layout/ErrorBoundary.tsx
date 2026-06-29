import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import { downloadText, backupFilename } from '../../utils/download'
import { captureError } from '../../utils/sentry'
import { t } from '../../i18n'

interface Props {
  children: ReactNode
  // 'page' = fallback de tela cheia (raiz do app). 'section' = fallback compacto
  // que isola a queda de uma área sem derrubar a navegação ao redor.
  variant?: 'page' | 'section'
  // Quando muda (ex.: a rota), limpa o erro para tentar renderizar de novo —
  // assim o usuário sai da área quebrada navegando, sem recarregar a página.
  resetKey?: unknown
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    captureError(error, { componentStack: info.componentStack, variant: this.props.variant ?? 'page' })
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  handleExportAndReset = () => {
    try {
      downloadText(backupFilename(), useStore.getState().exportData())
    } catch (e) {
      console.error('[ErrorBoundary] backup falhou', e)
    }
    if (!confirm('Backup baixado. Apagar TODOS os dados locais (ranges, histórico, estatísticas)?')) return
    if (!confirm(t.errorBoundary.resetConfirm)) return
    useStore.getState().resetLocalData()
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.variant === 'section') {
      return (
        <div className="bg-warm-900 border border-warm-700 rounded-2xl p-6 space-y-3 max-w-md">
          <h2 className="text-base font-bold text-white">{t.errorBoundary.sectionTitle}</h2>
          <p className="text-sm text-warm-400 break-words">
            {this.state.error.message || t.errorBoundary.sectionDefault}{t.errorBoundary.sectionHint}
          </p>
          <button
            onClick={() => location.reload()}
            className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
          >
            {t.errorBoundary.reload}
          </button>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-warm-950 text-warm-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-warm-900 border border-warm-700 rounded-2xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-white">{t.errorBoundary.appTitle}</h1>
          <p className="text-sm text-warm-400 break-words">
            {this.state.error.message || t.errorBoundary.appDefault}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => location.reload()}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
            >
              {t.errorBoundary.reload}
            </button>
            <button
              onClick={this.handleExportAndReset}
              className="w-full py-2.5 rounded-xl border border-warm-700 hover:border-warm-500 hover:bg-warm-800 text-warm-300 hover:text-white text-sm font-semibold transition-colors"
            >
              {t.errorBoundary.exportReset}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
