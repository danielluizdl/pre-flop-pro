import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'

interface CoachUser {
  id: number
  username: string
  name: string
  email: string
  created_at: number
  total_hands: number
  correct_hands: number | null
}

type CoachTab = 'hands' | 'consults' | 'sessions'

const TAB_LABELS: Record<CoachTab, string> = { hands: 'Mãos', consults: 'Consultas', sessions: 'Sessões' }

function formatDate(unix: number): string {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateShort(unix: number): string {
  if (!unix) return '—'
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function parseRangeNames(raw: string): string {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.join(', ') : String(raw)
  } catch {
    return String(raw)
  }
}

function accColor(acc: number): string {
  return acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'
}

interface Filters {
  playerId: number | null
  rangeId: number | null
  days: number | null
}

function useAnalytics<T>(view: string, filters: Filters, token: string | null) {
  const [rows, setRows] = useState<T[]>([])
  const [team, setTeam] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view })
    if (filters.playerId !== null) qs.set('playerId', String(filters.playerId))
    if (filters.rangeId !== null) qs.set('rangeId', String(filters.rangeId))
    if (filters.days !== null) qs.set('days', String(filters.days))
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (cancelled) return
        setRows(d.rows ?? [])
        setTeam(d.team ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erro ao carregar')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [view, token, filters.playerId, filters.rangeId, filters.days])

  return { rows, team, loading, error }
}

function Section({ title, loading, error, empty, children }: {
  title: string
  loading: boolean
  error: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-warm-200 mb-2">{title}</h3>
      {loading ? (
        <p className="text-sm text-warm-500">Carregando…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : empty ? (
        <p className="text-sm text-warm-500">Sem dados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-700">{children}</div>
      )}
    </div>
  )
}

const TH = 'text-left font-semibold px-3 py-2'
const THR = 'text-right font-semibold px-3 py-2'
const TD = 'px-3 py-2'
const TDR = 'px-3 py-2 text-right tabular-nums'

interface OverviewRow {
  userId: number; username: string; name: string; hands: number; accuracy: number
  graves: number; imprecisos: number; consults: number; sessions: number
  durationSeconds: number; lastActivity: number
}
interface LeakRow { rangeId: number; rangeName: string; hand: string; total: number; correct: number; graves: number; accuracy: number }
interface HotspotRow { rangeId: number; rangeName: string; hand: string | null; count: number }
interface ByRangeRow { rangeId: number; rangeName: string; hands: number; accuracy: number; graves: number; consults: number; players: number }

function TeamView({ token }: { token: string | null }) {
  const ranges = useStore(s => s.ranges)
  const [users, setUsers] = useState<CoachUser[]>([])
  const [filters, setFilters] = useState<Filters>({ playerId: null, rangeId: null, days: null })

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
  }, [token])

  const overview = useAnalytics<OverviewRow>('team-overview', filters, token)
  const leaks = useAnalytics<LeakRow>('leaks', filters, token)
  const hotspots = useAnalytics<HotspotRow>('consult-hotspots', filters, token)
  const byRange = useAnalytics<ByRangeRow>('by-range', filters, token)

  const selectCls = 'bg-warm-900 border border-warm-600 rounded-lg px-2.5 py-1.5 text-sm text-warm-100'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select
          className={selectCls}
          value={filters.playerId ?? ''}
          onChange={e => setFilters(f => ({ ...f, playerId: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">Todos os jogadores</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
        </select>
        <select
          className={selectCls}
          value={filters.rangeId ?? ''}
          onChange={e => setFilters(f => ({ ...f, rangeId: e.target.value !== '' ? Number(e.target.value) : null }))}
        >
          <option value="">Todos os ranges</option>
          {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select
          className={selectCls}
          value={filters.days ?? ''}
          onChange={e => setFilters(f => ({ ...f, days: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">Tudo</option>
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
        </select>
      </div>

      <Section title="Resumo do time" loading={overview.loading} error={overview.error} empty={overview.rows.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Jogador</th>
              <th className={THR}>Mãos</th>
              <th className={THR}>Precisão</th>
              <th className={THR}>Graves</th>
              <th className={THR}>Consultas</th>
              <th className={THR}>Tempo</th>
              <th className={THR}>Última ativ.</th>
            </tr>
          </thead>
          <tbody>
            {overview.rows.map(r => (
              <tr key={r.userId} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-100 font-semibold`}>{r.name || r.username}</td>
                <td className={`${TDR} text-warm-300`}>{r.hands}</td>
                <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
                <td className={`${TDR} text-red-400`}>{r.graves}</td>
                <td className={`${TDR} text-warm-400`}>{r.consults}</td>
                <td className={`${TDR} text-warm-400`}>{formatHours(r.durationSeconds)}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(r.lastActivity)}</td>
              </tr>
            ))}
            {overview.team && (
              <tr className="border-t-2 border-warm-600 bg-warm-800/40 font-bold">
                <td className={`${TD} text-white`}>TIME</td>
                <td className={`${TDR} text-warm-200`}>{overview.team.hands}</td>
                <td className={`${TDR} ${accColor(overview.team.accuracy)}`}>{overview.team.accuracy}%</td>
                <td className={`${TDR} text-red-400`}>{overview.team.graves}</td>
                <td className={`${TDR} text-warm-300`}>{overview.team.consults}</td>
                <td className={`${TDR} text-warm-300`}>{formatHours(overview.team.durationSeconds)}</td>
                <td className={`${TDR} text-warm-500`}>{formatDateShort(overview.team.lastActivity)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Maiores leaks" loading={leaks.loading} error={leaks.error} empty={leaks.rows.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Mão</th>
              <th className={TH}>Range</th>
              <th className={THR}>Tentativas</th>
              <th className={THR}>Precisão</th>
              <th className={THR}>Graves</th>
            </tr>
          </thead>
          <tbody>
            {leaks.rows.map((r, i) => (
              <tr key={i} className={`border-t border-warm-700/60 ${r.accuracy < 50 ? 'bg-red-950/30' : ''}`}>
                <td className={`${TD} text-warm-100 font-bold`}>{r.hand}</td>
                <td className={`${TD} text-warm-300`}>{r.rangeName}</td>
                <td className={`${TDR} text-warm-300`}>{r.total}</td>
                <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
                <td className={`${TDR} text-red-400`}>{r.graves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Hotspots de consulta" loading={hotspots.loading} error={hotspots.error} empty={hotspots.rows.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Range</th>
              <th className={TH}>Mão</th>
              <th className={THR}>Vezes</th>
            </tr>
          </thead>
          <tbody>
            {hotspots.rows.map((r, i) => (
              <tr key={i} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-300`}>{r.rangeName}</td>
                <td className={`${TD} text-warm-100`}>{r.hand ?? '—'}</td>
                <td className={`${TDR} text-warm-300`}>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Por range" loading={byRange.loading} error={byRange.error} empty={byRange.rows.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
              <th className={TH}>Range</th>
              <th className={THR}>Mãos</th>
              <th className={THR}>Precisão</th>
              <th className={THR}>Graves</th>
              <th className={THR}>Consultas</th>
              <th className={THR}>Jogadores</th>
            </tr>
          </thead>
          <tbody>
            {byRange.rows.map((r, i) => (
              <tr key={i} className="border-t border-warm-700/60">
                <td className={`${TD} text-warm-100 font-semibold`}>{r.rangeName}</td>
                <td className={`${TDR} text-warm-300`}>{r.hands}</td>
                <td className={`${TDR} font-bold ${accColor(r.accuracy)}`}>{r.accuracy}%</td>
                <td className={`${TDR} text-red-400`}>{r.graves}</td>
                <td className={`${TDR} text-warm-400`}>{r.consults}</td>
                <td className={`${TDR} text-warm-400`}>{r.players}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

function PlayersView({ token }: { token: string | null }) {
  const [users, setUsers] = useState<CoachUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<CoachTab>('hands')
  const [detail, setDetail] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar usuários'))))
      .then(data => setUsers(data.users ?? []))
      .catch(() => setError('Erro ao carregar usuários'))
  }, [token])

  useEffect(() => {
    if (!token || selectedUserId === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/user/${selectedUserId}?tab=${activeTab}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar dados'))))
      .then(data => { if (!cancelled) setDetail(data.data ?? []) })
      .catch(() => { if (!cancelled) setError('Erro ao carregar dados') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, selectedUserId, activeTab])

  const selectedUser = users.find(u => u.id === selectedUserId)
  const accuracyOf = (u: CoachUser) =>
    u.total_hands > 0 ? `${Math.round(((u.correct_hands ?? 0) / u.total_hands) * 100)}%` : '-'

  return (
    <div className="flex h-[calc(100vh-160px)] bg-warm-950 text-warm-100 rounded-2xl border border-warm-700/50 overflow-hidden">
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
              <span className="block text-sm font-medium text-warm-100">{u.name || u.username}</span>
              <span className="block text-xs text-warm-500">{u.username}</span>
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
            <h2 className="text-xl font-semibold text-white">{selectedUser.name || selectedUser.username}</h2>
            <p className="text-sm text-warm-400 mb-3">{selectedUser.username}{selectedUser.email ? ` · ${selectedUser.email}` : ''}</p>
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

export default function CoachPanel() {
  const authToken = useStore(s => s.authToken)
  const [area, setArea] = useState<'team' | 'players'>('team')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-warm-700">
        {([
          { key: 'team', label: 'Visão do time' },
          { key: 'players', label: 'Por jogador' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setArea(t.key)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              area === t.key ? 'border-brand-500 text-white' : 'border-transparent text-warm-400 hover:text-warm-200',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {area === 'team' ? <TeamView token={authToken} /> : <PlayersView token={authToken} />}
    </div>
  )
}
