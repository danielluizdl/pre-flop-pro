import { getAuthUser, hashPassword, randomHex, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Não autenticado' }, 401)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  const { newPassword } = body ?? {}
  if (!newPassword || newPassword.length < 8) return json({ error: 'Senha deve ter ao menos 8 caracteres' }, 400)

  const salt = randomHex(16)
  const hash = await hashPassword(newPassword, salt)
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ?, first_login = 0 WHERE id = ?')
    .bind(hash, salt, user.id).run()

  return json({ ok: true })
}
