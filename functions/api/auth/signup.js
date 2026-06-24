import { sha256Hex, hashPassword, randomHex, json, handleOptions, emailDomainExists, checkRateLimitKV, verifyTurnstile } from '../_utils.js'
import { sendEmail } from '../_email.js'

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
  const { username, password, teamCode, name, email, turnstileToken } = body ?? {}
  if (!(await verifyTurnstile(env, turnstileToken, ip))) return json({ error: 'Verificação anti-robô falhou' }, 403)
  if (!username || !password || !teamCode || !name || !email) {
    return json({ error: 'Campos obrigatórios: username, password, teamCode, name, email' }, 400)
  }
  if (!env.TEAM_CODE) return json({ error: 'Servidor sem TEAM_CODE configurado neste ambiente' }, 500)
  if (username.length < 6) return json({ error: 'Usuário deve ter ao menos 6 caracteres' }, 400)
  if (password.length < 8) return json({ error: 'Senha deve ter ao menos 8 caracteres' }, 400)
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email)) return json({ error: 'E-mail inválido' }, 400)
  if (teamCode.toLowerCase() !== env.TEAM_CODE.toLowerCase()) return json({ error: 'Código do time inválido' }, 403)
  if (!(await emailDomainExists(email.split('@')[1]))) return json({ error: 'E-mail inválido: domínio não existe' }, 400)

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (existing) return json({ error: 'Usuário já existe' }, 409)
  const emailTaken = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (emailTaken) return json({ error: 'E-mail já cadastrado' }, 409)

  const salt = randomHex(16)
  const hash = await hashPassword(password, salt)
  const result = await env.DB.prepare('INSERT INTO users (username, name, email, password_hash, salt, first_login) VALUES (?, ?, ?, ?, ?, 0)')
    .bind(username, name, email, hash, salt).run()

  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  await env.DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(result.meta.last_row_id, tokenHash, expiresAt).run()

  try {
    await sendEmail(env, {
      to: email,
      subject: 'Bem-vindo(a) ao Pre-Flop Pro',
      html: `<p>Olá ${name || username},</p>
<p>Sua conta no <strong>Pre-Flop Pro</strong> foi criada com sucesso. Treine seus ranges pré-flop até virar reflexo.</p>
<p>Usuário: <strong>${username}</strong></p>
<p>Bons estudos e boa sorte nas mesas!</p>`,
    })
  } catch { /* best-effort, nunca falha o cadastro */ }

  return json({ ok: true, token, user: { id: result.meta.last_row_id, username, name, email, role: 'player', first_login: 0 } })
}
