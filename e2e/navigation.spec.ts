import { test, expect } from '@playwright/test'

const FAKE_USER = { id: 1, username: 'tester', name: 'Tester', email: '', role: 'player', first_login: 0 }

async function mockBackend(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', r => r.fulfill({ json: { user: FAKE_USER } }))
  await page.route('**/api/auth/login', r => r.fulfill({ json: { ok: true, token: 'tok', user: FAKE_USER } }))
  await page.route('**/api/ranges/list', r => r.fulfill({ json: { version: 0, ranges: [] } }))
  await page.route('**/api/me/stats**', r => r.fulfill({ json: { rows: [], overview: null } }))
  await page.route('**/api/events/**', r => r.fulfill({ json: { ok: true } }))
}

test('logged-in user can navigate routes and use back button', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/')

  await page.locator('input[type="text"]').first().fill('tester')
  await page.locator('input[type="password"]').fill('password1')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Drill' }).click()
  await expect(page).toHaveURL(/\/drill$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('deep-link to /historico keeps the page after reload', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/historico')

  await page.locator('input[type="text"]').first().fill('tester')
  await page.locator('input[type="password"]').fill('password1')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/historico$/)
})
