import { getAuthUser, isShortStr, json, handleOptions } from '../_utils.js'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
const TIERS = ['fundamentals', 'evolution', 'metamorphosis', 'main']
const TURMAS = ['A', 'B', 'C', 'D']

export function validateAccountUpdatePayload(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body inválido' }
  const { name, email, tier, turma } = body
  if (!isShortStr(name, 80) || name.length < 1) return { ok: false, error: 'Nome inválido' }
  if (!isShortStr(email, 120) || !EMAIL_RE.test(email)) return { ok: false, error: 'E-mail inválido' }
  if (!TIERS.includes(tier)) return { ok: false, error: 'Tier inválido' }
  if (tier !== 'main' && !TURMAS.includes(turma)) return { ok: false, error: 'Turma inválida' }
  return { ok: true, turma: tier === 'main' ? null : turma }
}

// Self-service: o jogador edita os PRÓPRIOS dados (nome/e-mail/tier/turma).
// Sempre opera em cima de getAuthUser(...).id — nunca aceita um userId vindo
// do body, diferente de admin/update-user.js (coach-only, edita qualquer
// jogador). Username não é editável aqui de propósito.
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
  const validated = validateAccountUpdatePayload(body)
  if (!validated.ok) return json({ error: validated.error }, 400)
  const { name, email, tier } = body
  const turma = validated.turma

  const emailTaken = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(email, user.id).first()
  if (emailTaken) return json({ error: 'E-mail já cadastrado em outra conta' }, 409)

  await env.DB.prepare('UPDATE users SET name = ?, email = ?, tier = ?, turma = ? WHERE id = ?')
    .bind(name, email, tier, turma, user.id).run()

  return json({ ok: true, user: { id: user.id, name, email, tier, turma } })
}
