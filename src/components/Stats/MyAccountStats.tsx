import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'

interface Overview {
  hands: number
  correct: number
  errors: number
  accuracy: number
  graves: number
  imprecisos: number
  consults: number
  sessions: number
  durationSeconds: number
}

interface RangeRow {
  rangeId: number
  rangeName: string
  hands: number
  correct: number
  graves: number
  consults: number
  lastTrained: number
  accuracy: number
}

interface HandRow {
  hand: string
  total: number
  correct: number
  accuracy: number
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function accColor(acc: number): string {
  return acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'
}

export function MyAccountStats() {
  const authToken = useStore(s => s.authToken)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [rangeRows, setRangeRows] = useState<RangeRow[]>([])
  const [handRows, setHandRows] = useState<HandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    setLoading(true)
    setError('')
    const headers = { Authorization: `Bearer ${authToken}` }
    Promise.all([
      fetch('/api/me/stats?view=overview', { headers }).then(r => r.json()),
      fetch('/api/me/stats?view=by-range', { headers }).then(r => r.json()),
      fetch('/api/me/stats?view=by-hand', { headers }).then(r => r.json()),
    ])
      .then(([o, r, h]) => {
        if (cancelled) return
        setOverview(o.overview ?? null)
        setRangeRows(r.rows ?? [])
        setHandRows(h.rows ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Não foi possível carregar os dados da nuvem.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [authToken])

  if (loading) return <p className="text-warm-500 text-sm py-8 text-center">Carregando dados da nuvem…</p>
  if (error) return <p className="text-red-400 text-sm py-8 text-center">{error}</p>
  if (!overview) return null

  const cards = [
    { label: 'Mãos', value: overview.hands.toLocaleString(), color: 'text-warm-100' },
    { label: 'Precisão', value: `${overview.accuracy}%`, color: accColor(overview.accuracy) },
    { label: 'Blunders', value: String(overview.graves), color: 'text-red-400' },
    { label: 'Imprecisos', value: String(overview.imprecisos), color: 'text-yellow-400' },
    { label: 'Consultas', value: String(overview.consults), color: 'text-warm-300' },
    { label: 'Sessões', value: String(overview.sessions), color: 'text-brand-400' },
    { label: 'Tempo treinado', value: formatDuration(overview.durationSeconds), color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card-surface p-4 text-center">
            <div className="eyebrow mb-1">{c.label}</div>
            <div className={`font-display tabular-nums leading-none ${c.color}`} style={{ fontSize: 26, letterSpacing: '0.01em' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="eyebrow mb-2">Por range</div>
        {rangeRows.length === 0 ? (
          <p className="text-warm-500 text-sm">Sem dados ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-warm-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                  <th className="text-left font-semibold px-3 py-2">Range</th>
                  <th className="text-right font-semibold px-3 py-2">Mãos</th>
                  <th className="text-right font-semibold px-3 py-2">Precisão</th>
                  <th className="text-right font-semibold px-3 py-2">Blunder</th>
                  <th className="text-right font-semibold px-3 py-2">Consultas</th>
                  <th className="text-right font-semibold px-3 py-2">Último</th>
                </tr>
              </thead>
              <tbody>
                {rangeRows.map(r => (
                  <tr key={r.rangeId} className="border-t border-warm-700/60">
                    <td className="px-3 py-2 text-warm-100 font-semibold">{r.rangeName}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{r.hands}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-400">{r.graves}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-400">{r.consults}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-500">{formatDate(r.lastTrained)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow mb-2">Suas piores mãos</div>
        {handRows.length === 0 ? (
          <p className="text-warm-500 text-sm">Sem mãos com 3+ tentativas ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-warm-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                  <th className="text-left font-semibold px-3 py-2">Mão</th>
                  <th className="text-right font-semibold px-3 py-2">Tentativas</th>
                  <th className="text-right font-semibold px-3 py-2">Acertos</th>
                  <th className="text-right font-semibold px-3 py-2">Precisão</th>
                </tr>
              </thead>
              <tbody>
                {handRows.map(h => (
                  <tr key={h.hand} className="border-t border-warm-700/60">
                    <td className="px-3 py-2 text-warm-100 font-bold">{h.hand}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{h.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warm-300">{h.correct}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${accColor(h.accuracy)}`}>{h.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
