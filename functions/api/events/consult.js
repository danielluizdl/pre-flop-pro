import { getAuthUser, json, handleOptions, isUuidOrNull, isHand } from '../_utils.js'

export function validateConsultPayload(body) {
  if (!body || typeof body !== 'object') return false
  const { rangeId, hand } = body
  if (!Number.isInteger(rangeId) || rangeId < 0) return false
  if (hand !== null && hand !== undefined && !isHand(hand)) return false
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
  if (!validateConsultPayload(body)) return json({ ok: false, code: 'invalid_payload' }, 400)

  const { rangeId, rangeName, hand } = body

  await env.DB.prepare(
    'INSERT INTO consult_events (user_id, range_id, range_name, hand, session_uuid) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, rangeId, String(rangeName ?? ''), hand ?? null, body.session_uuid ?? null).run()

  return json({ ok: true })
}
