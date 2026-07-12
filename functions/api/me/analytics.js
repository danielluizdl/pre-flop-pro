import { getAuthUser, json, handleOptions } from '../_utils.js'
import { parseIntParam, runAnalyticsView } from '../admin/analytics.js'

// Views seguras para o jogador: todas filtram por user_id e nunca expõem
// dados de outros jogadores nem agregados do time.
export const PLAYER_VIEWS = ['by-range', 'leaks', 'consult-by-range', 'consult-by-range-hand', 'range-grid', 'build-range-grid']

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const url = new URL(request.url)
  const view = url.searchParams.get('view') ?? 'by-range'
  if (!PLAYER_VIEWS.includes(view)) return json({ error: 'view inválida' }, 400)

  const pRange = parseIntParam(url.searchParams.get('rangeId'), { min: 0 })
  const pDays = parseIntParam(url.searchParams.get('days'), { min: 1, max: 365 })
  const pFrom = parseIntParam(url.searchParams.get('from'), { min: 0, max: 4102444800 })
  const pTo = parseIntParam(url.searchParams.get('to'), { min: 0, max: 4102444800 })
  if (!pRange.ok || !pDays.ok || !pFrom.ok || !pTo.ok) return json({ error: 'Parâmetro inválido' }, 400)

  // playerIds vem SEMPRE do token — o parâmetro do cliente é ignorado.
  const filters = { playerIds: [user.id], rangeId: pRange.value, days: pDays.value, from: pFrom.value, to: pTo.value }
  return runAnalyticsView(env, url, view, filters)
}
