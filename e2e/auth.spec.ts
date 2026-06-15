import { test, expect } from '@playwright/test'

test('login page renders with core fields', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Treine seus ranges pré-flop')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('switch to signup reveals team code field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Nome Completo:')).toBeVisible()
  await expect(page.getByText('Código do time:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible()
})

test('forgot password view shows coach reset guidance', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await expect(page.getByText(/Peça ao coach/)).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})
