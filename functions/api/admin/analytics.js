import { getAuthUser, json, handleOptions } from '../_utils.js'

function parseIntParam(raw, { min, max }) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (!/^-?\d+$/.test(raw)) return { ok: false }
  const v = parseInt(raw, 10)
  if (min !== undefined && v < min) return { ok: false }
  if (max !== undefined && v > max) return { ok: false }
  return { ok: true, value: v }
}

function handFilters({ playerId, rangeId, days }) {
  const conds = []
  const binds = []
  if (playerId !== null) { conds.push('user_id = ?'); binds.push(playerId) }
  if (rangeId !== null) { conds.push('range_id = ?'); binds.push(rangeId) }
  if (days !== null) { conds.push('created_at >= unixepoch() - ?'); binds.push(days * 86400) }
  return { clause: conds.length ? 'WHERE ' + conds.join(' AND ') : '', binds }
}

const ACC = (correct, total) => (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0)

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (user.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const url = new URL(request.url)
  const view = url.searchParams.get('view') ?? 'team-overview'

  const pPlayer = parseIntParam(url.searchParams.get('playerId'), { min: 1 })
  const pRange = parseIntParam(url.searchParams.get('rangeId'), { min: 0 })
  const pDays = parseIntParam(url.searchParams.get('days'), { min: 1, max: 365 })
  if (!pPlayer.ok || !pRange.ok || !pDays.ok) return json({ error: 'Parâmetro inválido' }, 400)
  const filters = { playerId: pPlayer.value, rangeId: pRange.value, days: pDays.value }

  if (view === 'team-overview') {
    const hf = handFilters(filters)
    const handAgg = await env.DB.prepare(
      `SELECT user_id AS userId, COUNT(*) AS hands,
        CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos,
        MAX(created_at) AS lastActivity
       FROM hand_events ${hf.clause} GROUP BY user_id`
    ).bind(...hf.binds).all()

    const cConds = []
    const cBinds = []
    if (filters.playerId !== null) { cConds.push('user_id = ?'); cBinds.push(filters.playerId) }
    if (filters.rangeId !== null) { cConds.push('range_id = ?'); cBinds.push(filters.rangeId) }
    if (filters.days !== null) { cConds.push('created_at >= unixepoch() - ?'); cBinds.push(filters.days * 86400) }
    const consultAgg = await env.DB.prepare(
      `SELECT user_id AS userId, COUNT(*) AS consults FROM consult_events ${cConds.length ? 'WHERE ' + cConds.join(' AND ') : ''} GROUP BY user_id`
    ).bind(...cBinds).all()

    const sConds = []
    const sBinds = []
    if (filters.rangeId !== null) {
      // Sem range_id em training_sessions: vincula via session_uuid das maos daquele range.
      const subConds = ['range_id = ?', 'session_uuid IS NOT NULL']
      const subBinds = [filters.rangeId]
      if (filters.playerId !== null) { subConds.push('user_id = ?'); subBinds.push(filters.playerId) }
      if (filters.days !== null) { subConds.push('created_at >= unixepoch() - ?'); subBinds.push(filters.days * 86400) }
      sConds.push(`session_uuid IN (SELECT DISTINCT session_uuid FROM hand_events WHERE ${subConds.join(' AND ')})`)
      sBinds.push(...subBinds)
      if (filters.playerId !== null) { sConds.push('user_id = ?'); sBinds.push(filters.playerId) }
    } else {
      if (filters.playerId !== null) { sConds.push('user_id = ?'); sBinds.push(filters.playerId) }
      if (filters.days !== null) { sConds.push('ended_at >= unixepoch() - ?'); sBinds.push(filters.days * 86400) }
    }
    const sessionAgg = await env.DB.prepare(
      `SELECT user_id AS userId, COUNT(*) AS sessions, CAST(COALESCE(SUM(duration_seconds), 0) AS INTEGER) AS duration
       FROM training_sessions ${sConds.length ? 'WHERE ' + sConds.join(' AND ') : ''} GROUP BY user_id`
    ).bind(...sBinds).all()

    const usersRes = await env.DB.prepare(
      `SELECT id, username, name FROM users WHERE role = 'player'${filters.playerId !== null ? ' AND id = ?' : ''} ORDER BY username COLLATE NOCASE`
    ).bind(...(filters.playerId !== null ? [filters.playerId] : [])).all()

    const hMap = new Map((handAgg.results ?? []).map(r => [r.userId, r]))
    const cMap = new Map((consultAgg.results ?? []).map(r => [r.userId, r]))
    const sMap = new Map((sessionAgg.results ?? []).map(r => [r.userId, r]))

    const rows = (usersRes.results ?? []).map(u => {
      const h = hMap.get(u.id)
      const c = cMap.get(u.id)
      const s = sMap.get(u.id)
      const hands = h?.hands ?? 0
      const correct = h?.correct ?? 0
      return {
        userId: u.id,
        username: u.username,
        name: u.name,
        hands,
        correct,
        accuracy: ACC(correct, hands),
        graves: h?.graves ?? 0,
        imprecisos: h?.imprecisos ?? 0,
        consults: c?.consults ?? 0,
        sessions: s?.sessions ?? 0,
        durationSeconds: s?.duration ?? 0,
        lastActivity: h?.lastActivity ?? 0,
      }
    })

    const totalHands = rows.reduce((a, r) => a + r.hands, 0)
    const totalCorrect = rows.reduce((a, r) => a + r.correct, 0)
    const team = {
      hands: totalHands,
      accuracy: ACC(totalCorrect, totalHands),
      graves: rows.reduce((a, r) => a + r.graves, 0),
      imprecisos: rows.reduce((a, r) => a + r.imprecisos, 0),
      consults: rows.reduce((a, r) => a + r.consults, 0),
      sessions: rows.reduce((a, r) => a + r.sessions, 0),
      durationSeconds: rows.reduce((a, r) => a + r.durationSeconds, 0),
      lastActivity: rows.reduce((a, r) => Math.max(a, r.lastActivity), 0),
    }
    return json({ view, rows, team })
  }

  if (view === 'leaks') {
    const hf = handFilters(filters)
    const res = await env.DB.prepare(
      `SELECT range_id AS rangeId, range_name AS rangeName, hand,
        COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves
       FROM hand_events ${hf.clause}
       GROUP BY range_id, range_name, hand
       HAVING total >= 5
       ORDER BY (CAST(SUM(is_correct) AS REAL) / COUNT(*)) ASC
       LIMIT 100`
    ).bind(...hf.binds).all()
    const rows = (res.results ?? []).map(r => ({ ...r, accuracy: ACC(r.correct, r.total) }))
    return json({ view, rows })
  }

  if (view === 'consult-hotspots') {
    const conds = []
    const binds = []
    if (filters.playerId !== null) { conds.push('user_id = ?'); binds.push(filters.playerId) }
    if (filters.rangeId !== null) { conds.push('range_id = ?'); binds.push(filters.rangeId) }
    if (filters.days !== null) { conds.push('created_at >= unixepoch() - ?'); binds.push(filters.days * 86400) }
    const res = await env.DB.prepare(
      `SELECT range_id AS rangeId, range_name AS rangeName, hand, COUNT(*) AS count
       FROM consult_events ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
       GROUP BY range_id, range_name, hand
       ORDER BY count DESC
       LIMIT 100`
    ).bind(...binds).all()
    return json({ view, rows: res.results ?? [] })
  }

  if (view === 'by-range') {
    const hf = handFilters(filters)
    const handRes = await env.DB.prepare(
      `SELECT range_id AS rangeId, range_name AS rangeName,
        COUNT(*) AS hands, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        COUNT(DISTINCT user_id) AS players
       FROM hand_events ${hf.clause}
       GROUP BY range_id, range_name
       ORDER BY hands DESC`
    ).bind(...hf.binds).all()

    const cConds = []
    const cBinds = []
    if (filters.playerId !== null) { cConds.push('user_id = ?'); cBinds.push(filters.playerId) }
    if (filters.rangeId !== null) { cConds.push('range_id = ?'); cBinds.push(filters.rangeId) }
    if (filters.days !== null) { cConds.push('created_at >= unixepoch() - ?'); cBinds.push(filters.days * 86400) }
    const consultRes = await env.DB.prepare(
      `SELECT range_id AS rangeId, COUNT(*) AS consults FROM consult_events ${cConds.length ? 'WHERE ' + cConds.join(' AND ') : ''} GROUP BY range_id`
    ).bind(...cBinds).all()
    const cMap = new Map((consultRes.results ?? []).map(r => [r.rangeId, r.consults]))

    const rows = (handRes.results ?? []).map(r => ({
      ...r,
      accuracy: ACC(r.correct, r.hands),
      consults: cMap.get(r.rangeId) ?? 0,
    }))
    return json({ view, rows })
  }

  return json({ error: 'view inválida' }, 400)
}
