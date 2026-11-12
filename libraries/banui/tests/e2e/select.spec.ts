import { test, expect } from '@playwright/test'
import { size, css } from './util'

test('закрыт 28, открыт 28 + 26×3 + 4, перекрывает нижнее', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#s-select .ban-select-box').first()
  expect(await size(box)).toEqual([220, 28]); const y0 = (await page.locator('#below').boundingBox())!.y
  await box.getByRole('button').click(); await page.waitForTimeout(400)
  expect((await box.locator('.ban-select-pop').boundingBox())!.height).toBeCloseTo(110, 0)
  expect((await page.locator('#below').boundingBox())!.y).toBe(y0)                       // ничего не сдвинулось
  await expect(box.getByRole('option', { name: 'Español' })).toBeVisible()
})
test('недостроенный select уже имеет размер контрола', async ({ page }) => {
  await page.goto('/demo/specimen.html'); expect(await size(page.locator('#sel-raw'))).toEqual([220, 28])
})
test('выбор меняет подпись, значение и сообщает событием', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#s-select .ban-select-box').first()
  await box.getByRole('button').click(); await box.getByRole('option', { name: 'English' }).click()
  await expect(box.locator('.ban-select-label')).toHaveText('English'); await expect(page.locator('#sel-lang')).toHaveValue('English')
  await expect(box).toHaveAttribute('data-open', 'false')
})
test('клавиатура', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#s-select .ban-select-box').first(), btn = box.getByRole('button')
  await btn.focus(); await page.keyboard.press('ArrowDown'); await expect(box).toHaveAttribute('data-open', 'true')
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await expect(box.locator('.ban-select-label')).toHaveText('Español')
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await expect(box).toHaveAttribute('data-open', 'false'); await expect(btn).toBeFocused()
})
test('клик вне закрывает; одно значение и чужое значение', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#s-select .ban-select-box').first()
  await box.getByRole('button').click(); await page.locator('#below').click(); await expect(box).toHaveAttribute('data-open', 'false')
  expect(await page.evaluate(async () => { const url = '/src/controls/select/select.ts'; const { select } = await import(url); const c = select(document.querySelector('#sel-lang') as HTMLSelectElement); const before = c.value; c.value = 'Klingon'; return c.value === before })).toBe(true)
  const one = page.locator('#s-select .ban-select-box').nth(1); await one.getByRole('button').click(); await page.waitForTimeout(400)
  expect((await one.locator('.ban-select-pop').boundingBox())!.height).toBeCloseTo(58, 0)
})
test('Tab доходит до кнопки значения', async ({ page }) => {
  await page.goto('/demo/specimen.html'); await page.locator('#f-mail').focus(); await page.keyboard.press('Tab')
  await expect(page.locator('#s-select .ban-select-value').first()).toBeFocused()
})
test('строка под клавиатурой отмечена кольцом внутрь', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#s-select .ban-select-box').first()
  await box.getByRole('button').focus(); await page.keyboard.press('ArrowDown'); await expect(box).toHaveAttribute('data-open', 'true')
  const row = box.locator('[role="option"][data-active]')
  expect(await css(row, 'outline-style')).toBe('solid'); expect(await css(row, 'outline-width')).toBe('2px'); expect(await css(row, 'outline-offset')).toBe('-3px')
})
test('после немедленного выбора подпись остаётся на месте', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#s-select .ban-select-box').first()
  const pop = box.locator('.ban-select-pop'), lab = box.locator('.ban-select-label')
  const inside = async (): Promise<boolean> => {
    const p = (await pop.boundingBox())!, l = (await lab.boundingBox())!
    return l.y >= p.y && l.y + l.height <= p.y + p.height && l.x >= p.x && l.x + l.width <= p.x + p.width
  }
  await box.getByRole('button').click(); await box.getByRole('option', { name: 'Español' }).click()
  await expect(box).toHaveAttribute('data-open', 'false'); await page.waitForTimeout(400)
  expect(await pop.evaluate(el => el.scrollTop)).toBe(0); expect(await inside()).toBe(true)
  await box.getByRole('button').click(); await page.waitForTimeout(400)
  await box.getByRole('option').last().evaluate(el => el.scrollIntoView())
  await box.getByRole('option', { name: 'English' }).click()
  await expect(box).toHaveAttribute('data-open', 'false'); await page.waitForTimeout(400)
  expect(await pop.evaluate(el => el.scrollTop)).toBe(0); expect(await inside()).toBe(true)
  await expect(lab).toHaveText('English')
})
