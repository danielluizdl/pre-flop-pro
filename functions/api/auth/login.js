import { sha256Hex, hashPassword, randomHex, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  const { username, password } = body ?? {}
  if (!username || !password) return json({ error: 'Campos obrigatórios: username, password' }, 400)

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, salt, role, first_login FROM users WHERE username = ? COLLATE NOCASE'
  ).bind(username).first()
  if (!user) return json({ error: 'Credenciais inválidas' }, 401)

  const hash = await hashPassword(password, user.salt)
  if (hash !== user.password_hash) return json({ error: 'Credenciais inválidas' }, 401)

  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  await env.DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(user.id, tokenHash, expiresAt).run()

  return json({ ok: true, token, user: { id: user.id, username: user.username, role: user.role, first_login: user.first_login } })
}
