import { test, expect } from '@playwright/test'

test.describe('landing', () => {
  test('renders the hero and the primary Google CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Mnema').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /Continue with Google|使用 Google 繼續/ }).first()).toBeVisible()
  })

  test('language toggle flips EN ⇄ 中', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: /Switch to English|切換為中文/ }).first()
    await expect(toggle).toBeVisible()
    const before = (await toggle.textContent())?.trim()
    await toggle.click()
    await expect(toggle).not.toHaveText(before ?? '')
  })

  test('theme toggle flips the dark class on <html>', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    const wasDark = await html.evaluate((el) => el.classList.contains('dark'))
    await page.getByRole('button', { name: /light theme|dark theme|淺色主題|深色主題/ }).first().click()
    await expect.poll(() => html.evaluate((el) => el.classList.contains('dark'))).toBe(!wasDark)
  })

  test('the hero Lottie mounts (decorative svg present)', async ({ page }) => {
    await page.goto('/')
    // LottieArt renders an aria-hidden container; the player injects an <svg> once loaded.
    await expect(page.locator('[aria-hidden="true"] svg').first()).toBeVisible({ timeout: 10_000 })
  })
})
