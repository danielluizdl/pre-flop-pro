import { useStore } from '../../store/useStore'
import type { TrainingSession } from '../../types'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function SessionCard({ session }: { session: TrainingSession }) {
  const accuracy = session.hands > 0 ? Math.round((session.correct / session.hands) * 100) : 0
  const color = accuracy >= 70 ? 'text-emerald-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex gap-4 items-start">
      <div className={`text-3xl font-extrabold w-14 text-center flex-shrink-0 ${color}`}>
        {accuracy}%
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-gray-400">{formatDate(session.timestamp)}</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-400">{session.tableSize}-max</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-400">{formatDuration(session.durationSeconds)}</span>
        </div>
        <div className="text-sm font-semibold text-white truncate mb-2">
          {session.rangeNames.join(', ') || 'Sem nome'}
        </div>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-gray-300">Mãos: <strong className="text-white">{session.hands}</strong></span>
          <span className="text-emerald-400">Acertos: <strong>{session.correct}</strong></span>
          <span className="text-red-400">Erros: <strong>{session.errors}</strong></span>
          {session.consults > 0 && (
            <span className="text-gray-500">Consultas: <strong>{session.consults}</strong></span>
          )}
        </div>
      </div>
    </div>
  )
}

export function StatsPage() {
  const trainingHistory = useStore(s => s.trainingHistory)
  const sessions = [...trainingHistory].reverse()

  const totalHands = trainingHistory.reduce((s, x) => s + x.hands, 0)
  const totalCorrect = trainingHistory.reduce((s, x) => s + x.correct, 0)
  const globalAccuracy = totalHands > 0 ? Math.round((totalCorrect / totalHands) * 100) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Histórico de Treinos</h1>
        <p className="text-xs text-gray-400">{sessions.length} sessão(ões) registrada(s)</p>
      </div>

      {/* Summary */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sessões', value: sessions.length.toString(), color: 'text-brand-400' },
            { label: 'Mãos Totais', value: totalHands.toLocaleString(), color: 'text-blue-400' },
            {
              label: 'Precisão Global',
              value: globalAccuracy !== null ? `${globalAccuracy}%` : '—',
              color: globalAccuracy === null ? 'text-gray-500'
                   : globalAccuracy >= 70 ? 'text-emerald-400'
                   : globalAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400',
            },
          ].map(item => (
            <div key={item.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Nenhuma sessão registrada ainda.</p>
          <p className="text-gray-500 text-xs mt-1">Complete um treino para ver o histórico aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {sessions.map(s => <SessionCard key={s.id} session={s} />)}
        </div>
      )}
    </div>
  )
}
