import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import { downloadText, backupFilename } from '../../utils/download'

interface Props {
  children: ReactNode
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
  }

  handleExportAndReset = () => {
    try {
      downloadText(backupFilename(), useStore.getState().exportData())
    } catch (e) {
      console.error('[ErrorBoundary] backup falhou', e)
    }
    if (!confirm('Backup baixado. Apagar TODOS os dados locais (ranges, histórico, estatísticas)?')) return
    if (!confirm('Esta ação é irreversível. Confirmar reset dos dados locais?')) return
    useStore.getState().resetLocalData()
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-warm-950 text-warm-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-warm-900 border border-warm-700 rounded-2xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-white">Algo deu errado</h1>
          <p className="text-sm text-warm-400 break-words">
            {this.state.error.message || 'Erro inesperado na aplicação.'}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => location.reload()}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
            >
              Recarregar
            </button>
            <button
              onClick={this.handleExportAndReset}
              className="w-full py-2.5 rounded-xl border border-warm-700 hover:border-warm-500 hover:bg-warm-800 text-warm-300 hover:text-white text-sm font-semibold transition-colors"
            >
              Exportar backup e resetar dados locais
            </button>
          </div>
        </div>
      </div>
    )
  }
}
