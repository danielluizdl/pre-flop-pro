import { getAuthUser, json, handleOptions, isUuidOrNull, isShortStr } from '../_utils.js'

export function validateRangeBuildPayload(body) {
  if (!body || typeof body !== 'object') return false
  if (!Number.isInteger(body.rangeId) || body.rangeId < 0) return false
  if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 100) return false
  if (body.stackRange !== null && body.stackRange !== undefined && !isShortStr(body.stackRange, 50)) return false
  if (body.roundsTotal !== null && body.roundsTotal !== undefined && (!Number.isInteger(body.roundsTotal) || body.roundsTotal < 1)) return false
  if (!isUuidOrNull(body.session_uuid)) return false
  if (!isUuidOrNull(body.client_event_id)) return false
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

  const { rangeId, rangeName, stackRange, score, roundsTotal } = body

  // Fail-open enquanto a migração schema_v4 não for aplicada: um 500 aqui
  // travaria a fila FIFO de telemetria do cliente (flush para em erro != 400).
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO range_build_events (user_id, range_id, range_name, stack_range, score, rounds_total, session_uuid, client_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      user.id, rangeId, String(rangeName ?? ''), stackRange ?? null, score, roundsTotal ?? null,
      body.session_uuid ?? null, body.client_event_id ?? null
    ).run()
  } catch {
    return json({ ok: false, code: 'db_error' })
  }

  return json({ ok: true })
}
