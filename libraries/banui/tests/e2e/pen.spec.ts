import { test, expect } from '@playwright/test'

test.use({ deviceScaleFactor: 4 })

async function shot(page: import('@playwright/test').Page, id: string) {
  return page.locator(id).screenshot({ animations: 'disabled' })
}
test('непоказанный штрих не оставляет следа', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished)))
  expect((await shot(page, '#pen-rest')).equals(await shot(page, '#pen-empty'))).toBe(true)
})
test('штрих при ошибке нарисован', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished)))
  expect((await shot(page, '#pen-error')).equals(await shot(page, '#pen-empty'))).toBe(false)
})
