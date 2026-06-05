import { test, expect } from '@playwright/test'

test('footer nav reaches the self-host page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Self-host|自行架設/ }).first().click()
  await expect(page).toHaveURL(/\/self-host$/)
  await expect(page.getByText('Mnema').first()).toBeVisible()
})

test('footer nav reaches the FAQ page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /^FAQ$|常見問題/ }).first().click()
  await expect(page).toHaveURL(/\/faq$/)
})

test('FAQ accordion opens an answer', async ({ page }) => {
  await page.goto('/faq')
  const firstSummary = page.locator('summary').first()
  await expect(firstSummary).toBeVisible()
  await firstSummary.click()
  await expect(page.locator('details[open]').first()).toBeVisible()
})

test('logged-out visiting the app redirects to the public landing', async ({ page }) => {
  await page.goto('/today')
  await expect(page).toHaveURL(/\/$|\/\?/)
  await expect(page.getByRole('button', { name: /Continue with Google|使用 Google 繼續/ }).first()).toBeVisible()
})
