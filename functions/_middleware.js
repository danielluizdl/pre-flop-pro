import { isAllowedOrigin } from './api/_utils.js'

// CORS por allowlist: ecoa o Access-Control-Allow-Origin só para origens
// conhecidas (produção, previews *.pre-flop-pro.pages.dev, localhost). Pós-
// processa todas as respostas das Functions, evitando repetir CORS em cada
// handler. Origens fora da allowlist não recebem ACAO (same-origin segue OK).
export async function onRequest(context) {
  const { request, next } = context
  const origin = request.headers.get('Origin')
  const res = await next()
  if (!isAllowedOrigin(origin)) return res
  const out = new Response(res.body, res)
  out.headers.set('Access-Control-Allow-Origin', origin)
  out.headers.append('Vary', 'Origin')
  return out
}
