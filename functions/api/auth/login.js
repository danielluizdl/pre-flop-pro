import { sha256Hex, hashPassword, verifyPassword, isLegacyHash, equalizeTiming, randomHex, json, handleOptions, checkRateLimitKV, verifyTurnstile } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!(await checkRateLimitKV(env, ip))) return json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  const { username, password, turnstileToken } = body ?? {}
  if (!username || !password) return json({ error: 'Campos obrigatórios: username, password' }, 400)
  if (!(await verifyTurnstile(env, turnstileToken, ip))) return json({ error: 'Verificação anti-robô falhou' }, 403)

  const user = await env.DB.prepare(
    'SELECT id, username, name, email, password_hash, salt, role, first_login FROM users WHERE username = ? COLLATE NOCASE'
  ).bind(username).first()
  if (!user) {
    await equalizeTiming(password)
    return json({ error: 'Credenciais inválidas' }, 401)
  }

  if (!(await verifyPassword(password, user.salt, user.password_hash))) {
    return json({ error: 'Credenciais inválidas' }, 401)
  }

  if (isLegacyHash(user.password_hash)) {
    const newSalt = randomHex(16)
    const newHash = await hashPassword(password, newSalt)
    await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
      .bind(newHash, newSalt, user.id).run()
  }

  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  await env.DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(user.id, tokenHash, expiresAt).run()

  return json({ ok: true, token, user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, first_login: user.first_login } })
}
