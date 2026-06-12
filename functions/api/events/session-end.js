import { getAuthUser, json, handleOptions, isUuidOrNull } from '../_utils.js'

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0
}

export function validateSessionPayload(body) {
  if (!body || typeof body !== 'object') return false
  if (!Array.isArray(body.rangeNames)) return false
  for (const k of ['hands', 'correct', 'errors', 'consults', 'durationSeconds']) {
    if (body[k] !== undefined && body[k] !== null && !isNonNegInt(body[k])) return false
  }
  if (body.startedAt !== undefined && body.startedAt !== null && !Number.isInteger(body.startedAt)) return false
  if (!isUuidOrNull(body.session_uuid)) return false
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
  if (!validateSessionPayload(body)) return json({ ok: false, code: 'invalid_payload' }, 400)

  const { rangeNames, hands, correct, errors, consults, durationSeconds, startedAt } = body
  const now = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    'INSERT INTO training_sessions (user_id, range_names, hands, correct, errors, consults, duration_seconds, started_at, ended_at, session_uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    user.id, JSON.stringify(rangeNames), hands ?? 0, correct ?? 0, errors ?? 0, consults ?? 0,
    durationSeconds ?? 0, Math.floor(startedAt ?? now), now, body.session_uuid ?? null
  ).run()

  return json({ ok: true })
}
