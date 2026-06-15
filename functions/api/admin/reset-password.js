import { getAuthUser, hashPassword, randomHex, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: 'userId inválido' }, 400)

  const target = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(userId).first()
  if (!target) return json({ error: 'Jogador não encontrado' }, 404)

  const tempPassword = randomHex(5)
  const salt = randomHex(16)
  const hash = await hashPassword(tempPassword, salt)
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ?, first_login = 1 WHERE id = ?')
    .bind(hash, salt, userId).run()
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()

  return json({ ok: true, tempPassword })
}
