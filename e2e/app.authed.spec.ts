import { test, expect } from '@playwright/test'

// These run signed-in as the dedicated test account (storageState from auth.setup).

test('app boots signed in, with the space rail', async ({ page }) => {
  await page.goto('/today')
  await expect(page).toHaveURL(/\/today/) // not bounced to the public landing
  await expect(page.getByRole('link', { name: /Study|讀書/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Capture anything|隨手暫存/ }).first()).toBeVisible()
})

test('the space rail switches spaces in one tap', async ({ page }) => {
  await page.goto('/today')
  await page.getByRole('link', { name: /Tempo|節奏/ }).first().click()
  await expect(page).toHaveURL(/\/tempo/)
  await page.getByRole('link', { name: /Money|記帳/ }).first().click()
  await expect(page).toHaveURL(/\/galleon/)
  await page.getByRole('link', { name: /Travel|旅遊/ }).first().click()
  await expect(page).toHaveURL(/\/trips/)
})

test('global Capture front door writes to the inbox', async ({ page }) => {
  await page.goto('/today')
  const stamp = `e2e capture ${Date.now()}`
  await page.getByRole('button', { name: /Capture anything|隨手暫存/ }).first().click()
  await page.getByRole('dialog').getByRole('textbox').fill(stamp)
  await page.getByRole('button', { name: /^Capture$|^暫存$/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden() // closes only after create_capture resolves
  await page.goto('/tempo?view=capture')
  await expect(page.getByText(stamp)).toBeVisible()
})

test('create an image flashcard and the image shows up', async ({ page }) => {
  await page.goto('/today')
  await page.getByRole('button', { name: /Write a note|寫一則筆記/ }).click()
  await expect(page).toHaveURL(/\/notes\//)

  await page.getByRole('button', { name: /Add flashcard|新增字卡/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Front|正面/).fill(`e2e img ${Date.now()}`)
  await dialog.getByLabel(/^Back|背面/).fill('e2e back')
  await dialog.locator('input[type="file"]').setInputFiles('e2e/fixtures/pixel.png')
  await expect(dialog.locator('img')).toBeVisible({ timeout: 15_000 }) // upload finished → preview
  await dialog.getByRole('button', { name: /^Add card$|^新增字卡$/ }).click()
  await expect(dialog).toBeHidden()

  // the new card's tile (with the uploaded image) renders on the note page
  await expect(page.locator('img[src*="/storage/v1/object/public/uploads/"]').first()).toBeVisible({ timeout: 10_000 })
})

test('habit check-in toggles, then undoes a misclick', async ({ page }) => {
  await page.goto('/tempo?view=habits')
  const title = `e2e habit ${Date.now()}`
  const quick = page.getByPlaceholder(/Add a habit|新增一個習慣/)
  await quick.fill(title)
  await quick.press('Enter')

  const checkIn = page.getByRole('button', { name: /Check in for today|打卡今天/ })
  await expect(checkIn.first()).toBeVisible()
  await checkIn.first().click()

  const undo = page.getByRole('button', { name: /Undo today|取消今天/ })
  await expect(undo.first()).toBeVisible() // flipped to checked
  await undo.first().click()
  await expect(page.getByRole('button', { name: /Check in for today|打卡今天/ }).first()).toBeVisible() // undone
})
