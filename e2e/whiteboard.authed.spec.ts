import { test, expect } from '@playwright/test'

// Exercises the whole save path of the scratch whiteboard, signed in as the
// dedicated test account: open the board → draw a stroke → Save → the flattened
// image is uploaded, a sketch note is created, and it shows in the Sketches lens.

test('whiteboard: draw a sketch, save it, and see it in the Sketches lens', async ({ page }) => {
  await page.goto('/notes')

  // Open the full-screen board from the Notes header.
  await page.getByRole('button', { name: /^Sketch$|^塗鴉$/ }).first().click()

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  // Save is disabled on a blank board.
  const save = page.getByRole('button', { name: /^Save$|^儲存$/ })
  await expect(save).toBeDisabled()

  // Draw one freehand stroke across the canvas (Playwright mouse → pointer events).
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.65, { steps: 10 })
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.4, { steps: 10 })
  await page.mouse.up()

  // A stroke enables Save; commit it.
  await expect(save).toBeEnabled()
  await save.click()

  // The board closes and the new sketch (its uploaded image) shows in the grid.
  await expect(canvas).toBeHidden({ timeout: 15_000 })
  await expect(
    page.locator('img[src*="/storage/v1/object/public/uploads/"]').first(),
  ).toBeVisible({ timeout: 15_000 })
})
