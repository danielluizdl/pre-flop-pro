import { getAuthUser, json, handleOptions } from '../_utils.js'
import { buildRangeGridCells } from '../admin/analytics.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const url = new URL(request.url)
  const view = url.searchParams.get('view') ?? 'overview'
  const uid = user.id

  if (view === 'overview') {
    const h = await env.DB.prepare(
      `SELECT COUNT(*) AS hands,
        CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos
       FROM hand_events WHERE user_id = ?`
    ).bind(uid).first()
    const c = await env.DB.prepare('SELECT COUNT(*) AS consults FROM consult_events WHERE user_id = ?').bind(uid).first()
    const s = await env.DB.prepare(
      'SELECT COUNT(*) AS sessions, CAST(COALESCE(SUM(duration_seconds), 0) AS INTEGER) AS duration FROM training_sessions WHERE user_id = ?'
    ).bind(uid).first()
    const hands = h?.hands ?? 0
    const correct = h?.correct ?? 0
    return json({
      view,
      overview: {
        hands,
        correct,
        errors: hands - correct,
        accuracy: hands > 0 ? Math.round((correct / hands) * 1000) / 10 : 0,
        graves: h?.graves ?? 0,
        imprecisos: h?.imprecisos ?? 0,
        consults: c?.consults ?? 0,
        sessions: s?.sessions ?? 0,
        durationSeconds: s?.duration ?? 0,
      },
    })
  }

  if (view === 'by-range') {
    const r = await env.DB.prepare(
      `SELECT h.range_id AS rangeId, h.range_name AS rangeName,
        COUNT(*) AS hands,
        CAST(SUM(h.is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN h.severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        MAX(h.created_at) AS lastTrained,
        (SELECT COUNT(*) FROM consult_events c WHERE c.user_id = h.user_id AND c.range_id = h.range_id) AS consults
       FROM hand_events h
       WHERE h.user_id = ?
       GROUP BY h.range_id, h.range_name
       ORDER BY hands DESC`
    ).bind(uid).all()
    const rows = (r.results ?? []).map(row => ({
      ...row,
      accuracy: row.hands > 0 ? Math.round((row.correct / row.hands) * 1000) / 10 : 0,
    }))
    return json({ view, rows })
  }

  if (view === 'by-hand') {
    const r = await env.DB.prepare(
      `SELECT hand, COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct
       FROM hand_events WHERE user_id = ?
       GROUP BY hand
       HAVING total >= 3
       ORDER BY (CAST(SUM(is_correct) AS REAL) / COUNT(*)) ASC
       LIMIT 50`
    ).bind(uid).all()
    const rows = (r.results ?? []).map(row => ({
      ...row,
      accuracy: row.total > 0 ? Math.round((row.correct / row.total) * 1000) / 10 : 0,
    }))
    return json({ view, rows })
  }

  if (view === 'sessions') {
    const r = await env.DB.prepare(
      'SELECT * FROM training_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 100'
    ).bind(uid).all()
    return json({ view, rows: r.results ?? [] })
  }

  // Replay mão a mão de uma sessão de Drill específica — sob demanda (o
  // detalhe só é buscado quando o jogador abre a sessão na lista).
  if (view === 'session-hands') {
    const sessionUuid = url.searchParams.get('session_uuid')
    if (!sessionUuid) return json({ error: 'session_uuid obrigatório' }, 400)
    try {
      const r = await env.DB.prepare(
        `SELECT hand, action_taken AS actionTaken, correct_action AS correctAction, is_correct AS isCorrect,
          severity, rng, stack_range AS stackRange, stack_grid_idx AS stackGridIdx, suits, raise_size AS raiseSize,
          range_id AS rangeId, range_name AS rangeName, created_at AS createdAt
         FROM hand_events WHERE user_id = ? AND session_uuid = ?
         ORDER BY created_at ASC, id ASC`
      ).bind(uid, sessionUuid).all()
      return json({ view, rows: r.results ?? [] })
    } catch {
      return json({ view, rows: [] })
    }
  }

  // Views do modo Range Check. Fail-open: range_build_events (schema_v4) e
  // range_build_sessions (schema_v8) podem não existir — devolve zeros/vazio.
  if (view === 'build-overview') {
    let overview = { rounds: 0, avgScore: 0, bestScore: 0, ranges: 0, sessions: 0, durationSeconds: 0, lastActivity: 0 }
    try {
      const e = await env.DB.prepare(
        `SELECT COUNT(*) AS rounds, ROUND(COALESCE(AVG(score), 0), 1) AS avgScore,
          ROUND(COALESCE(MAX(score), 0), 1) AS bestScore,
          COUNT(DISTINCT range_id) AS ranges,
          COUNT(DISTINCT session_uuid) AS sessions,
          COALESCE(MAX(created_at), 0) AS lastActivity
         FROM range_build_events WHERE user_id = ?`
      ).bind(uid).first()
      if (e) {
        overview = {
          rounds: e.rounds ?? 0,
          avgScore: e.avgScore ?? 0,
          bestScore: e.bestScore ?? 0,
          ranges: e.ranges ?? 0,
          sessions: e.sessions ?? 0,
          lastActivity: e.lastActivity ?? 0,
          durationSeconds: 0,
        }
      }
    } catch { /* tabela ausente */ }
    try {
      const s = await env.DB.prepare(
        'SELECT COUNT(*) AS sessions, CAST(COALESCE(SUM(duration_seconds), 0) AS INTEGER) AS duration FROM range_build_sessions WHERE user_id = ?'
      ).bind(uid).first()
      overview.durationSeconds = s?.duration ?? 0
      if ((s?.sessions ?? 0) > overview.sessions) overview.sessions = s.sessions
    } catch { /* tabela ausente */ }
    return json({ view, overview })
  }

  if (view === 'build-by-range') {
    let rows
    try {
      const r = await env.DB.prepare(
        `SELECT range_id AS rangeId, MAX(range_name) AS rangeName, COUNT(*) AS attempts,
          ROUND(AVG(score), 1) AS avgScore, ROUND(MAX(score), 1) AS bestScore,
          MAX(created_at) AS lastActivity
         FROM range_build_events WHERE user_id = ?
         GROUP BY range_id ORDER BY attempts DESC`
      ).bind(uid).all()
      rows = r.results ?? []
    } catch {
      return json({ view, rows: [] })
    }

    // Acertos/erros por mão somados em todas as tentativas de cada range —
    // reaproveita a mesma agregação da Matriz do range (build-range-grid),
    // só que agrupada por range em vez de rodar pra um range só. Fail-open:
    // wrong_hands/user_grid (schema_v9) podem não existir ainda.
    try {
      const raw = await env.DB.prepare(
        'SELECT range_id AS rangeId, wrong_hands AS wrongHands, user_grid AS userGrid FROM range_build_events WHERE user_id = ?'
      ).bind(uid).all()
      const byRange = new Map()
      for (const row of raw.results ?? []) {
        const list = byRange.get(row.rangeId) ?? []
        list.push({
          wrongHands: row.wrongHands ? JSON.parse(row.wrongHands) : {},
          userGrid: row.userGrid ? JSON.parse(row.userGrid) : {},
        })
        byRange.set(row.rangeId, list)
      }
      rows = rows.map(row => {
        const cells = buildRangeGridCells(byRange.get(row.rangeId) ?? [])
        return {
          ...row,
          correctHands: cells.reduce((s, c) => s + c.correct, 0),
          wrongHands: cells.reduce((s, c) => s + (c.total - c.correct), 0),
        }
      })
    } catch { /* segue sem acertos/erros por mão */ }

    return json({ view, rows })
  }

  if (view === 'build-sessions') {
    let rows = []
    try {
      const r = await env.DB.prepare(
        `SELECT session_uuid AS sessionUuid, COUNT(*) AS rounds,
          ROUND(AVG(score), 1) AS avgScore, MIN(created_at) AS startedAt,
          GROUP_CONCAT(DISTINCT range_name) AS rangeNames
         FROM range_build_events WHERE user_id = ? AND session_uuid IS NOT NULL
         GROUP BY session_uuid ORDER BY startedAt DESC LIMIT 100`
      ).bind(uid).all()
      rows = r.results ?? []
    } catch {
      return json({ view, rows: [] })
    }
    try {
      const s = await env.DB.prepare(
        'SELECT session_uuid AS sessionUuid, duration_seconds AS durationSeconds, rounds_total AS roundsTotal FROM range_build_sessions WHERE user_id = ?'
      ).bind(uid).all()
      const sMap = new Map((s.results ?? []).map(x => [x.sessionUuid, x]))
      rows = rows.map(row => {
        const meta = sMap.get(row.sessionUuid)
        return { ...row, durationSeconds: meta?.durationSeconds ?? null, roundsTotal: meta?.roundsTotal ?? null }
      })
    } catch { /* tabela ausente: sessões saem sem duração */ }
    return json({ view, rows })
  }

  // Replay rodada a rodada de uma sessão de Range Check específica — sob
  // demanda, igual ao session-hands do Drill.
  if (view === 'build-session-rounds') {
    const sessionUuid = url.searchParams.get('session_uuid')
    if (!sessionUuid) return json({ error: 'session_uuid obrigatório' }, 400)
    try {
      const r = await env.DB.prepare(
        `SELECT range_id AS rangeId, range_name AS rangeName, stack_range AS stackRange, score, attempt,
          user_grid AS userGrid, answer_grid AS answerGrid, created_at AS createdAt
         FROM range_build_events WHERE user_id = ? AND session_uuid = ?
         ORDER BY created_at ASC, id ASC`
      ).bind(uid, sessionUuid).all()
      return json({ view, rows: r.results ?? [] })
    } catch {
      return json({ view, rows: [] })
    }
  }

  return json({ error: 'view inválida' }, 400)
}
