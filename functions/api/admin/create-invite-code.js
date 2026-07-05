import { getAuthUser, randomHex, json, handleOptions } from '../_utils.js'

export function formatInviteCode(hex) {
  return hex.toUpperCase()
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  let code
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = formatInviteCode(randomHex(4))
    const existing = await env.DB.prepare('SELECT id FROM invite_codes WHERE code = ?').bind(candidate).first()
    if (!existing) { code = candidate; break }
  }
  if (!code) return json({ error: 'Não foi possível gerar um código único, tente novamente' }, 500)

  await env.DB.prepare('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)').bind(code, coach.id).run()

  return json({ ok: true, code })
}
