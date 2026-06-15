import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { RangeHeatGrid, type GridCell } from './RangeHeatGrid'

const POSITION_ORDER = ['STR', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'EP', 'LJ', 'UTG']

interface RangeOpt { id: number; name: string; positions?: string[]; stackGrids?: { stackRange: string; name?: string }[] }
function groupRangesByPosition(ranges: RangeOpt[]) {
  const groups = new Map<string, RangeOpt[]>()
  for (const r of ranges) {
    const pos = r.positions?.[0] ?? 'Outros'
    if (!groups.has(pos)) groups.set(pos, [])
    groups.get(pos)!.push(r)
  }
  const rank = (p: string) => { const i = POSITION_ORDER.indexOf(p); return i === -1 ? 999 : i }
  return [...groups.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(pos => ({ pos, items: groups.get(pos)!.sort((x, y) => x.name.localeCompare(y.name)) }))
}

function MultiPlayerSelect({ users, selected, onChange }: {
  users: { id: number; username: string; name: string }[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const nameOf = (id: number) => { const u = users.find(x => x.id === id); return u ? (u.name || u.username) : '' }
  const label = selected.length === 0 ? 'Todos os jogadores' : selected.length === 1 ? nameOf(selected[0]) : `${selected.length} jogadores`
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-warm-900 border border-warm-600 rounded-lg px-2.5 py-1.5 text-sm text-warm-100 flex items-center gap-2 min-w-[190px] justify-between"
      >
        <span className="truncate">{label}</span>
        <span className="text-warm-400 text-xs select-none">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 max-h-72 overflow-y-auto bg-warm-900 border border-warm-600 rounded-lg shadow-xl p-1">
          <button
            onClick={() => onChange([])}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${selected.length === 0 ? 'text-brand-300 font-semibold' : 'text-warm-300 hover:bg-warm-800'}`}
          >
            Todos os jogadores
          </button>
          <div className="h-px bg-warm-700 my-1" />
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-warm-200 hover:bg-warm-800 cursor-pointer">
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="accent-brand-500" />
              <span className="truncate">{u.name || u.username}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

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
  playerIds: number[]
  rangeId: number | null
  days: number | null
}

function useAnalytics<T>(view: string, filters: Filters, token: string | null) {
  const [rows, setRows] = useState<T[]>([])
  const [team, setTeam] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const idsKey = filters.playerIds.join(',')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view })
    if (idsKey) qs.set('playerIds', idsKey)
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
  }, [view, token, idsKey, filters.rangeId, filters.days])

  return { rows, team, loading, error }
}

function useRangeGrid(rangeId: number | null, days: number | null, playerIds: number[], stackIdx: number | null, token: string | null) {
  const [cells, setCells] = useState<GridCell[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const idsKey = playerIds.join(',')

  useEffect(() => {
    if (!token || rangeId === null) { setCells([]); return }
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ view: 'range-grid', rangeId: String(rangeId) })
    if (idsKey) qs.set('playerIds', idsKey)
    if (stackIdx !== null) qs.set('stackGridIdx', String(stackIdx))
    if (days !== null) qs.set('days', String(days))
    fetch(`/api/admin/analytics?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => { if (!cancelled) { setCells(d.cells ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Erro ao carregar'); setLoading(false) } })
    return () => { cancelled = true }
  }, [token, rangeId, days, idsKey, stackIdx])

  return { cells, loading, error }
}

function Section({ title, loading, error, empty, children, defaultOpen = true }: {
  title: string
  loading: boolean
  error: string
  empty: boolean
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-warm-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-warm-800/40 hover:bg-warm-800 transition-colors"
      >
        <h3 className="text-sm font-semibold text-warm-200">{title}</h3>
        <span className="text-warm-400 text-xs select-none">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        loading ? (
          <p className="text-sm text-warm-500 px-3 py-3">Carregando…</p>
        ) : error ? (
          <p className="text-sm text-red-400 px-3 py-3">{error}</p>
        ) : empty ? (
          <p className="text-sm text-warm-500 px-3 py-3">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto border-t border-warm-700">{children}</div>
        )
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
  const [filters, setFilters] = useState<Filters>({ playerIds: [], rangeId: null, days: null })
  const [stackIdx, setStackIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
  }, [token])

  useEffect(() => { setStackIdx(null) }, [filters.rangeId])

  const sortedUsers = [...users].sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username))
  const rangeGroups = groupRangesByPosition(ranges)

  const overview = useAnalytics<OverviewRow>('team-overview', filters, token)
  const leaks = useAnalytics<LeakRow>('leaks', filters, token)
  const hotspots = useAnalytics<HotspotRow>('consult-hotspots', filters, token)
  const byRange = useAnalytics<ByRangeRow>('by-range', filters, token)
  const grid = useRangeGrid(filters.rangeId, filters.days, filters.playerIds, stackIdx, token)

  const selectedRange = ranges.find(r => r.id === filters.rangeId)
  const selectedRangeName = selectedRange?.name ?? ''
  const selectedStackGrids = selectedRange?.stackGrids ?? []
  const confusionRows = [...grid.cells]
    .filter(c => c.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 15)

  const selectCls = 'bg-warm-900 border border-warm-600 rounded-lg px-2.5 py-1.5 text-sm text-warm-100'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3" style={{ order: -2 }}>
        <MultiPlayerSelect
          users={sortedUsers}
          selected={filters.playerIds}
          onChange={ids => setFilters(f => ({ ...f, playerIds: ids }))}
        />
        <select
          className={selectCls}
          value={filters.rangeId ?? ''}
          onChange={e => setFilters(f => ({ ...f, rangeId: e.target.value !== '' ? Number(e.target.value) : null }))}
        >
          <option value="">Todos os ranges</option>
          {rangeGroups.map(g => (
            <optgroup key={g.pos} label={g.pos}>
              {g.items.map(r => {
                const n = r.stackGrids?.length ?? 0
                return <option key={r.id} value={r.id}>{r.name}{n > 1 ? ` · ${n} stacks` : ''}</option>
              })}
            </optgroup>
          ))}
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

      <Section title="Resumo do time" defaultOpen={false} loading={overview.loading} error={overview.error} empty={overview.rows.length === 0}>
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

      <Section title="Maiores leaks" defaultOpen={false} loading={leaks.loading} error={leaks.error} empty={leaks.rows.length === 0}>
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

      <Section title="Hotspots de consulta" defaultOpen={false} loading={hotspots.loading} error={hotspots.error} empty={hotspots.rows.length === 0}>
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

      <Section title="Por range" defaultOpen={false} loading={byRange.loading} error={byRange.error} empty={byRange.rows.length === 0}>
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
              <tr
                key={i}
                onClick={() => setFilters(f => ({ ...f, rangeId: r.rangeId }))}
                className={`border-t border-warm-700/60 cursor-pointer hover:bg-warm-800/50 ${filters.rangeId === r.rangeId ? 'bg-warm-800/70' : ''}`}
              >
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

      <div style={{ order: -1 }}>
        <h3 className="text-sm font-semibold text-warm-200 mb-2">
          Matriz do range {selectedRangeName ? <span className="text-brand-400">· {selectedRangeName}</span> : ''}
          {filters.playerIds.length > 0 && <span className="text-warm-500 text-xs font-normal"> · {filters.playerIds.length} jogador(es)</span>}
        </h3>
        {filters.rangeId !== null && selectedStackGrids.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-xs text-warm-500 mr-1">Stack efetivo:</span>
            <button
              onClick={() => setStackIdx(null)}
              className={[
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                stackIdx === null ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
              ].join(' ')}
            >
              Todos
            </button>
            {selectedStackGrids.map((sg, i) => (
              <button
                key={i}
                onClick={() => setStackIdx(i)}
                className={[
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  stackIdx === i ? 'bg-brand-600 border-brand-500 text-white' : 'bg-warm-800 border-warm-600 text-warm-400 hover:text-warm-200',
                ].join(' ')}
              >
                {sg.name || sg.stackRange}
              </button>
            ))}
          </div>
        )}
        {filters.rangeId === null ? (
          <p className="text-sm text-warm-500">Selecione um range no filtro acima (ou clique numa linha da tabela "Por range") para ver a matriz 13×13.</p>
        ) : grid.loading ? (
          <p className="text-sm text-warm-500">Carregando…</p>
        ) : grid.error ? (
          <p className="text-sm text-red-400">{grid.error}</p>
        ) : grid.cells.length === 0 ? (
          <p className="text-sm text-warm-500">Sem dados para este range no período/jogador selecionado.</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="rounded-xl border border-warm-700 bg-warm-900/40 p-4">
              <RangeHeatGrid cells={grid.cells} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-warm-400 mb-2">Mãos com pior precisão — correto vs. erro mais comum</p>
              <div className="overflow-x-auto rounded-xl border border-warm-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-warm-800 text-warm-400 text-xs uppercase">
                      <th className={TH}>Mão</th>
                      <th className={THR}>Tent.</th>
                      <th className={THR}>Precisão</th>
                      <th className={TH}>Correto</th>
                      <th className={TH}>Erram mais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confusionRows.map(c => (
                      <tr key={c.hand} className={`border-t border-warm-700/60 ${c.accuracy < 50 ? 'bg-red-950/30' : ''}`}>
                        <td className={`${TD} text-warm-100 font-bold`}>{c.hand}</td>
                        <td className={`${TDR} text-warm-300`}>{c.total}</td>
                        <td className={`${TDR} font-bold ${accColor(c.accuracy)}`}>{c.accuracy}%</td>
                        <td className={`${TD} text-emerald-300`}>{c.correctAction ?? '—'}</td>
                        <td className={`${TD} text-red-300`}>{c.topWrong ? `${c.topWrong.action} (${c.topWrong.n}x)` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
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
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{ userId: number; tempPassword: string } | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Erro ao carregar usuários'))))
      .then(data => setUsers(data.users ?? []))
      .catch(() => setError('Erro ao carregar usuários'))
  }, [token])

  useEffect(() => { setResetResult(null); setResetError(null); setCopied(false) }, [selectedUserId])

  async function handleResetPassword(userId: number) {
    if (!token || resetting) return
    if (!confirm('Resetar a senha deste jogador? A senha atual deixará de funcionar e ele precisará usar a senha temporária.')) return
    setResetting(true)
    setResetError(null)
    setResetResult(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) { setResetError(data?.error ?? `Erro do servidor (${res.status})`); return }
      setResetResult({ userId, tempPassword: data.tempPassword })
    } catch {
      setResetError('Erro de conexão')
    } finally {
      setResetting(false)
    }
  }

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
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedUser.name || selectedUser.username}</h2>
                <p className="text-sm text-warm-400 mb-3">{selectedUser.username}{selectedUser.email ? ` · ${selectedUser.email}` : ''}</p>
              </div>
              <button
                onClick={() => handleResetPassword(selectedUser.id)}
                disabled={resetting}
                className="px-3 py-1.5 text-sm rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 hover:text-white disabled:opacity-40 transition-colors"
              >
                {resetting ? 'Resetando…' : 'Resetar senha'}
              </button>
            </div>

            {resetError && <p className="text-sm text-red-400 mb-3">{resetError}</p>}
            {resetResult && resetResult.userId === selectedUser.id && (
              <div className="mb-4 rounded-xl border border-brand-600/50 bg-warm-800/60 p-3">
                <p className="text-xs text-warm-400 mb-1.5">Senha temporária — repasse ao jogador. Ele definirá uma nova senha no próximo acesso.</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-bold tracking-widest text-brand-300 select-all">{resetResult.tempPassword}</code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); setCopied(true) }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-warm-600 text-warm-300 hover:bg-warm-800 transition-colors"
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

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
