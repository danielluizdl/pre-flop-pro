import { getAuthUser, isShortStr, json, handleOptions } from '../_utils.js'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

export function validateUpdateUserPayload(body) {
  if (!body || typeof body !== 'object') return false
  if (!Number.isInteger(body.userId) || body.userId <= 0) return false
  if (!isShortStr(body.name, 80) || body.name.length < 1) return false
  if (!isShortStr(body.email, 120) || !EMAIL_RE.test(body.email)) return false
  return true
}

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
  if (!validateUpdateUserPayload(body)) return json({ error: 'Dados inválidos: nome e e-mail são obrigatórios' }, 400)

  const { userId, name, email } = body
  const target = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first()
  if (!target) return json({ error: 'Conta não encontrada' }, 404)
  if (target.role !== 'player') return json({ error: 'Só é possível editar contas de jogador' }, 403)

  const emailTaken = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(email, userId).first()
  if (emailTaken) return json({ error: 'E-mail já cadastrado em outra conta' }, 409)

  await env.DB.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').bind(name, email, userId).run()

  return json({ ok: true, user: { id: userId, name, email } })
}
