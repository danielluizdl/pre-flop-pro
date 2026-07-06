import { sha256Hex, hashPassword, randomHex, escapeHtml, json, handleOptions, emailDomainExists, checkRateLimitKV, verifyTurnstile } from '../_utils.js'
import { sendEmail } from '../_email.js'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
const TIERS = ['fundamentals', 'evolution', 'metamorphosis', 'main']
const TURMAS = ['A', 'B', 'C', 'D']

export function validateSignupFields(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body inválido' }
  const { username, password, inviteCode, name, email, tier, turma } = body
  if (!username || !password || !inviteCode || !name || !email || !tier) {
    return { ok: false, error: 'Campos obrigatórios: username, password, inviteCode, name, email, tier' }
  }
  if (username.length < 6) return { ok: false, error: 'Usuário deve ter ao menos 6 caracteres' }
  if (password.length < 6) return { ok: false, error: 'Senha deve ter ao menos 6 caracteres' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'E-mail inválido' }
  if (!TIERS.includes(tier)) return { ok: false, error: 'Tier inválido' }
  if (tier !== 'main' && !TURMAS.includes(turma)) return { ok: false, error: 'Turma inválida' }
  return { ok: true, turma: tier === 'main' ? null : turma }
}

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
  const { username, password, inviteCode, name, email, turnstileToken } = body ?? {}
  if (!(await verifyTurnstile(env, turnstileToken, ip))) return json({ error: 'Verificação anti-robô falhou' }, 403)

  const validated = validateSignupFields(body)
  if (!validated.ok) return json({ error: validated.error }, 400)
  const { tier } = body ?? {}
  const turma = validated.turma

  const invite = await env.DB.prepare('SELECT id FROM invite_codes WHERE code = ? AND used_by IS NULL').bind(inviteCode).first()
  if (!invite) return json({ error: 'Código de convite inválido ou já utilizado' }, 403)
  if (!(await emailDomainExists(email.split('@')[1]))) return json({ error: 'E-mail inválido: domínio não existe' }, 400)

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (existing) return json({ error: 'Usuário já existe' }, 409)
  const emailTaken = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (emailTaken) return json({ error: 'E-mail já cadastrado' }, 409)

  const salt = randomHex(16)
  const hash = await hashPassword(password, salt)
  const result = await env.DB.prepare('INSERT INTO users (username, name, email, password_hash, salt, first_login, tier, turma) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
    .bind(username, name, email, hash, salt, tier, turma).run()

  await env.DB.prepare('UPDATE invite_codes SET used_by = ?, used_at = unixepoch() WHERE id = ?')
    .bind(result.meta.last_row_id, invite.id).run()

  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  await env.DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(result.meta.last_row_id, tokenHash, expiresAt).run()

  try {
    await sendEmail(env, {
      to: email,
      subject: 'Bem-vindo(a) ao Pre-Flop Pro',
      html: `<p>Olá ${escapeHtml(name || username)},</p>
<p>Sua conta no <strong>Pre-Flop Pro</strong> foi criada com sucesso. Treine seus ranges pré-flop até virar reflexo.</p>
<p>Usuário: <strong>${escapeHtml(username)}</strong></p>
<p>Bons estudos e boa sorte nas mesas!</p>`,
    })
  } catch { /* best-effort, nunca falha o cadastro */ }

  return json({ ok: true, token, user: { id: result.meta.last_row_id, username, name, email, role: 'player', first_login: 0 } })
}
