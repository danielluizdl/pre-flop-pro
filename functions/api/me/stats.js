import { getAuthUser, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const view = new URL(request.url).searchParams.get('view') ?? 'overview'
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

  return json({ error: 'view inválida' }, 400)
}
