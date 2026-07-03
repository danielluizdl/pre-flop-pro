import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

// Smoke de render: builda-se antes (npm run smoke), aqui serve o dist e abre
// num Chromium headless. Falha com exit 1 se houver pageerror/console.error,
// se o #root não montar, ou se a navegação via RouterSync quebrar — pega os
// dois modos de tela branca que teste+build verdes já deixaram passar
// (ciclo de chunks e loop do RouterSync).

const PORT = 4173
const BASE = `http://localhost:${PORT}`

function findChromium() {
  if (process.env.SMOKE_CHROMIUM && existsSync(process.env.SMOKE_CHROMIUM)) return process.env.SMOKE_CHROMIUM
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium'
  try {
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch { /* segue para a mensagem abaixo */ }
  return null
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* servidor ainda subindo */ }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`vite preview não respondeu em ${url}`)
}

const executablePath = findChromium()
if (!executablePath) {
  console.error('Chromium não encontrado. Defina SMOKE_CHROMIUM=<caminho do chrome> ou instale um browser do Playwright.')
  process.exit(1)
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const problems = []

try {
  await waitForServer(BASE)
  const browser = await chromium.launch({ executablePath })
  const page = await browser.newPage()

  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    // Recursos externos (fonts/CDN) são bloqueados de propósito — só origem local conta.
    const src = msg.location()?.url ?? ''
    if (msg.text().includes('Failed to load resource') && !src.startsWith(BASE)) return
    problems.push(`console.error: ${msg.text()}`)
  })

  // Sem rede externa: o smoke só depende do dist servido localmente.
  await page.route(u => !u.href.startsWith(BASE), r => r.abort())

  // Backend stubado: sessão restaurada vira um jogador logado sem rede real.
  await page.route('**/api/auth/me', r => r.fulfill({ json: { user: { id: 1, username: 'smoke', name: 'Smoke', email: '', role: 'player', first_login: 0 } } }))
  await page.route('**/api/ranges/list', r => r.fulfill({ json: { ranges: [], version: 0 } }))
  await page.route('**/api/events/**', r => r.fulfill({ json: { ok: true } }))
  await page.route('**/api/me/**', r => r.fulfill({ json: { overview: null, rows: [] } }))
  await page.addInitScript(() => sessionStorage.setItem('pfp-auth-token', 'smoke-token'))

  // 1. Boot logado no dashboard — #root precisa montar conteúdo real.
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => (document.getElementById('root')?.children.length ?? 0) > 0, undefined, { timeout: 10000 })
  const gotNav = await page.getByRole('button', { name: 'Drill' }).first().isVisible().catch(() => false)
  if (!gotNav) problems.push('dashboard logado não renderizou a navegação (possível tela branca)')

  // 2. Navegação via RouterSync (store→URL) e volta (URL→store).
  await page.getByRole('button', { name: 'Drill' }).first().click()
  await page.waitForURL('**/drill', { timeout: 5000 }).catch(() => problems.push('clicar em Drill não levou a /drill (RouterSync store→URL)'))
  await page.goBack()
  await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => problems.push('voltar do browser não retornou a /dashboard (RouterSync URL→store)'))

  // 3. F5 em rota profunda — regressão clássica do RouterSync.
  await page.goto(`${BASE}/historico`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => (document.getElementById('root')?.children.length ?? 0) > 0, undefined, { timeout: 10000 })
  if (!page.url().includes('/historico')) problems.push(`F5 em /historico terminou em ${page.url()} (RouterSync dessincronizou)`)

  // 4. Drill de verdade: seleciona ranges seedados, inicia e responde uma mão.
  await page.goto(`${BASE}/drill`, { waitUntil: 'networkidle' })
  try {
    await page.getByRole('button', { name: /^STR/ }).first().click()
    await page.getByRole('button', { name: 'Selecionar todos' }).first().click()
    await page.getByRole('button', { name: /CONTINUAR/ }).click()
    await page.getByRole('button', { name: 'INICIAR TREINO' }).click()
    await page.getByRole('button', { name: /FOLD/ }).first().click({ timeout: 8000 })
    await page.waitForFunction(() => /✓|✗|~/.test(document.body.innerText), undefined, { timeout: 5000 })
  } catch (e) {
    problems.push(`fluxo do drill quebrou: ${e.message.split('\n')[0]}`)
  }

  // 5. Painel do coach com analytics stubado.
  const coach = await page.context().browser().newPage()
  coach.on('pageerror', e => problems.push(`coach pageerror: ${e.message}`))
  await coach.route(u => !u.href.startsWith(BASE), r => r.abort())
  await coach.route('**/api/auth/me', r => r.fulfill({ json: { user: { id: 2, username: 'coach', name: 'Coach', email: '', role: 'coach', first_login: 0 } } }))
  await coach.route('**/api/ranges/list', r => r.fulfill({ json: { ranges: [], version: 0 } }))
  await coach.route('**/api/admin/users', r => r.fulfill({ json: { users: [] } }))
  await coach.route('**/api/admin/analytics*', r => r.fulfill({ json: { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] } }))
  await coach.addInitScript(() => sessionStorage.setItem('pfp-auth-token', 'smoke-coach'))
  await coach.goto(`${BASE}/coach`, { waitUntil: 'networkidle' })
  const gotCoach = await coach.getByRole('button', { name: 'Visão do time' }).first().isVisible().catch(() => false)
  if (!gotCoach) problems.push('painel do coach não renderizou a aba Visão do time')
  await coach.close()

  // Fôlego para um eventual loop de render estourar como pageerror/console.
  await page.waitForTimeout(1500)
  await browser.close()
} catch (e) {
  problems.push(`smoke crash: ${e.message}`)
} finally {
  preview.kill()
}

if (problems.length > 0) {
  console.error(`SMOKE FALHOU (${problems.length} problema(s)):`)
  for (const p of problems) console.error(` - ${p}`)
  process.exit(1)
}
console.log('SMOKE OK — render, navegação/F5, drill completo e painel do coach íntegros no browser.')
