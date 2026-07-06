import { getAuthUser, hashPassword, randomHex, isShortStr, escapeHtml, logAdminAction, checkRateLimitKV, json, handleOptions } from '../_utils.js'
import { sendEmail } from '../_email.js'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

export function validateCreateUserPayload(body) {
  if (!body || typeof body !== 'object') return false
  if (!isShortStr(body.username, 40) || body.username.length < 6) return false
  if (!isShortStr(body.name, 80) || body.name.length < 1) return false
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (!isShortStr(body.email, 120) || !EMAIL_RE.test(body.email)) return false
  }
  return true
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!(await checkRateLimitKV(env, ip, Date.now(), 'admin'))) {
    return json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  if (!validateCreateUserPayload(body)) return json({ error: 'Dados inválidos: usuário (≥6), nome e e-mail (se informado) precisam ser válidos' }, 400)

  const username = body.username
  const name = body.name
  const email = body.email || ''

  const existingUsername = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (existingUsername) return json({ error: 'Usuário já existe' }, 409)
  if (email) {
    const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existingEmail) return json({ error: 'E-mail já cadastrado' }, 409)
  }

  const tempPassword = randomHex(5)
  const salt = randomHex(16)
  const hash = await hashPassword(tempPassword, salt)
  const result = await env.DB.prepare(
    'INSERT INTO users (username, name, email, password_hash, salt, first_login) VALUES (?, ?, ?, ?, ?, 1)'
  ).bind(username, name, email, hash, salt).run()

  if (email) {
    try {
      await sendEmail(env, {
        to: email,
        subject: 'Pre-Flop Pro — sua conta foi criada',
        html: `<p>Olá ${escapeHtml(name || username)},</p>
<p>O coach criou uma conta pra você no <strong>Pre-Flop Pro</strong>. Use a senha temporária abaixo para entrar; no primeiro acesso você definirá uma nova senha.</p>
<p style="font-size:20px;font-weight:bold;letter-spacing:2px">${tempPassword}</p>
<p>Usuário: <strong>${escapeHtml(username)}</strong></p>`,
      })
    } catch { /* best-effort */ }
  }

  await logAdminAction(env, coach.id, 'create_user', result.meta.last_row_id, { username })

  return json({ ok: true, tempPassword, user: { id: result.meta.last_row_id, username, name, email } })
}
