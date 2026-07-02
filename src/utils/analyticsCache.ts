// Cache curto (por URL) das chamadas de analytics do painel coach. Trocar de aba
// ou alternar um filtro e voltar reusa o último resultado por alguns segundos em
// vez de refazer o fetch. reload() do hook chama invalidateAnalyticsCache() para
// forçar dados frescos.
const cache = new Map<string, { ts: number; data: unknown }>()

export const ANALYTICS_CACHE_TTL = 15000

export function invalidateAnalyticsCache() {
  cache.clear()
}

// Retorna `any` como `Response.json()` — os hooks do CoachPanel leem campos
// específicos (rows/team/byHand/...) do payload, cada um com seu shape.
export function fetchAnalyticsCached(url: string, token: string, ttl = ANALYTICS_CACHE_TTL): Promise<any> {
  const now = Date.now()
  const hit = cache.get(url)
  if (hit && now - hit.ts < ttl) return Promise.resolve(hit.data)
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
    .then(data => {
      cache.set(url, { ts: now, data })
      return data
    })
}
