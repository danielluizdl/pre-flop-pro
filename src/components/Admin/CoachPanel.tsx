import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'

interface CoachUser {
  id: number
  username: string
  created_at: number
  total_hands: number
  correct_hands: number | null
}

type CoachTab = 'hands' | 'consults' | 'sessions'

const TAB_LABELS: Record<CoachTab, string> = { hands: 'Mãos', consults: 'Consultas', sessions: 'Sessões' }

function formatDate(unix: number): string {
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function parseRangeNames(raw: string): string {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.join(', ') : String(raw)
  } catch {
    return String(raw)
  }
}

export default function CoachPanel() {
  const authToken = useStore(s => s.authToken)

  const [users, setUsers]                 = useState<CoachUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab]         = useState<CoachTab>('hands')
  const [detail, setDetail]               = useState<any[]>([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    if (!authToken) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar usuários')))
      .then(data => setUsers(data.users ?? []))
      .catch(() => setError('Erro ao carregar usuários'))
  }, [authToken])

  useEffect(() => {
    if (!authToken || selectedUserId === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/user/${selectedUserId}?tab=${activeTab}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar dados')))
      .then(data => { if (!cancelled) setDetail(data.data ?? []) })
      .catch(() => { if (!cancelled) setError('Erro ao carregar dados') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authToken, selectedUserId, activeTab])

  const selectedUser = users.find(u => u.id === selectedUserId)

  const accuracyOf = (u: CoachUser) =>
    u.total_hands > 0 ? `${Math.round(((u.correct_hands ?? 0) / u.total_hands) * 100)}%` : '-'

  return (
    <div className="flex h-[calc(100vh-90px)] bg-warm-950 text-warm-100 rounded-2xl border border-warm-700/50 overflow-hidden">
      <div className="w-64 border-r border-warm-700/50 overflow-y-auto">
        <h2 className="px-4 py-3 text-sm font-semibold text-warm-300 border-b border-warm-700/50">Jogadores</h2>
        {users.length === 0 ? (
          <p className="px-4 py-4 text-sm text-warm-500">Nenhum jogador cadastrado ainda.</p>
        ) : (
          users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={`w-full text-left px-4 py-3 border-b border-warm-800 transition-colors ${selectedUserId === u.id ? 'bg-warm-800' : 'hover:bg-warm-900'}`}
            >
              <span className="block text-sm font-medium text-warm-100">{u.username}</span>
              <span className="block text-xs text-warm-400">{u.total_hands} mãos · {accuracyOf(u)}</span>
            </button>
          ))
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {!selectedUser ? (
          <p className="text-sm text-warm-500">Selecione um jogador.</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white mb-3">{selectedUser.username}</h2>
            <div className="flex gap-1 mb-4">
              {(['hands', 'consults', 'sessions'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${activeTab === tab ? 'border-brand-500 text-brand-300 bg-warm-800' : 'border-warm-600 text-warm-300 hover:bg-warm-800'}`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            {loading ? (
              <p className="text-sm text-warm-500">Carregando...</p>
            ) : detail.length === 0 ? (
              <p className="text-sm text-warm-500">Sem dados.</p>
            ) : activeTab === 'hands' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-400 border-b border-warm-700">
                    <th className="py-2 pr-3">Mão</th>
                    <th className="py-2 pr-3">Range</th>
                    <th className="py-2 pr-3">Ação</th>
                    <th className="py-2 pr-3">Correto</th>
                    <th className="py-2 pr-3">Acertou</th>
                    <th className="py-2 pr-3">Severidade</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} className="border-b border-warm-800">
                      <td className="py-2 pr-3 font-medium">{row.hand}</td>
                      <td className="py-2 pr-3 text-warm-300">{row.range_name}</td>
                      <td className="py-2 pr-3">{row.action_taken}</td>
                      <td className="py-2 pr-3">{row.correct_action}</td>
                      <td className={`py-2 pr-3 ${row.is_correct ? 'text-green-400' : 'text-red-400'}`}>{row.is_correct ? 'Sim' : 'Não'}</td>
                      <td className="py-2 pr-3 text-warm-400">{row.severity ?? ''}</td>
                      <td className="py-2 text-warm-400">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'consults' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-400 border-b border-warm-700">
                    <th className="py-2 pr-3">Range</th>
                    <th className="py-2 pr-3">Mão</th>
                    <th className="py-2">Consultas</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} className="border-b border-warm-800">
                      <td className="py-2 pr-3 text-warm-300">{row.range_name}</td>
                      <td className="py-2 pr-3">{row.hand ?? '-'}</td>
                      <td className="py-2">{row.count}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-400 border-b border-warm-700">
                    <th className="py-2 pr-3">Ranges</th>
                    <th className="py-2 pr-3">Mãos</th>
                    <th className="py-2 pr-3">Acerto</th>
                    <th className="py-2 pr-3">Erros</th>
                    <th className="py-2 pr-3">Consultas</th>
                    <th className="py-2 pr-3">Duração</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row, i) => (
                    <tr key={i} className="border-b border-warm-800">
                      <td className="py-2 pr-3 text-warm-300">{parseRangeNames(row.range_names)}</td>
                      <td className="py-2 pr-3">{row.hands}</td>
                      <td className="py-2 pr-3">{row.hands > 0 ? `${Math.round((row.correct / row.hands) * 100)}%` : '-'}</td>
                      <td className="py-2 pr-3">{row.errors}</td>
                      <td className="py-2 pr-3">{row.consults}</td>
                      <td className="py-2 pr-3">{formatDuration(row.duration_seconds)}</td>
                      <td className="py-2 text-warm-400">{formatDate(row.ended_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
