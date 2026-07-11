import { getAuthUser, json, handleOptions, isUuidOrNull, isShortStr, isHand, validateSparseGrid } from '../_utils.js'

export function validateWrongHands(v) {
  if (v === null || v === undefined) return true
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const keys = Object.keys(v)
  if (keys.length > 169) return false
  for (const k of keys) {
    if (!isHand(k)) return false
    const n = v[k]
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1) return false
  }
  return true
}

export function validateRangeBuildPayload(body) {
  if (!body || typeof body !== 'object') return false
  if (!Number.isInteger(body.rangeId) || body.rangeId < 0) return false
  if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 100) return false
  if (body.stackRange !== null && body.stackRange !== undefined && !isShortStr(body.stackRange, 50)) return false
  if (body.roundsTotal !== null && body.roundsTotal !== undefined && (!Number.isInteger(body.roundsTotal) || body.roundsTotal < 1)) return false
  if (body.attempt !== null && body.attempt !== undefined && (!Number.isInteger(body.attempt) || body.attempt < 1)) return false
  if (!isUuidOrNull(body.session_uuid)) return false
  if (!isUuidOrNull(body.client_event_id)) return false
  if (!validateWrongHands(body.wrongHands)) return false
  if (!validateSparseGrid(body.userGrid)) return false
  if (!validateSparseGrid(body.answerGrid)) return false
  return true
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ ok: false, code: 'unauthenticated' })

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  if (!validateRangeBuildPayload(body)) return json({ ok: false, code: 'invalid_payload' }, 400)

  const { rangeId, rangeName, stackRange, score, attempt, roundsTotal } = body
  const wrongHands = body.wrongHands && Object.keys(body.wrongHands).length > 0 ? JSON.stringify(body.wrongHands) : null
  const userGrid = body.userGrid && Object.keys(body.userGrid).length > 0 ? JSON.stringify(body.userGrid) : null
  const answerGrid = body.answerGrid && Object.keys(body.answerGrid).length > 0 ? JSON.stringify(body.answerGrid) : null

  // Fail-open enquanto as migrações não forem aplicadas: um 500 aqui travaria
  // a fila FIFO de telemetria do cliente (flush para em erro != 400). Se as
  // colunas novas (wrong_hands do schema_v8, user_grid/answer_grid do
  // schema_v9) ainda não existirem, regrava sem elas.
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO range_build_events (user_id, range_id, range_name, stack_range, score, attempt, rounds_total, session_uuid, client_event_id, wrong_hands, user_grid, answer_grid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      user.id, rangeId, String(rangeName ?? ''), stackRange ?? null, score, attempt ?? 1, roundsTotal ?? null,
      body.session_uuid ?? null, body.client_event_id ?? null, wrongHands, userGrid, answerGrid
    ).run()
  } catch {
    try {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO range_build_events (user_id, range_id, range_name, stack_range, score, attempt, rounds_total, session_uuid, client_event_id, wrong_hands) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        user.id, rangeId, String(rangeName ?? ''), stackRange ?? null, score, attempt ?? 1, roundsTotal ?? null,
        body.session_uuid ?? null, body.client_event_id ?? null, wrongHands
      ).run()
    } catch {
      try {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO range_build_events (user_id, range_id, range_name, stack_range, score, attempt, rounds_total, session_uuid, client_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          user.id, rangeId, String(rangeName ?? ''), stackRange ?? null, score, attempt ?? 1, roundsTotal ?? null,
          body.session_uuid ?? null, body.client_event_id ?? null
        ).run()
      } catch {
        return json({ ok: false, code: 'db_error' })
      }
    }
  }

  return json({ ok: true })
}
