import { test, expect } from '@playwright/test'

test('окно проходится клавишами, знак фокуса виден на каждом контроле', async ({ page }) => {
  await page.goto('/demo/settings.html'); const seen = new Set<string>()
  const focus = () => page.evaluate(() => { const e = document.activeElement as HTMLElement, cs = getComputedStyle(e), box = e.closest('.ban-field-box')
    return { inWin: !!e.closest('#win-light'), kind: e.classList[0] ?? e.getAttribute('role') ?? e.tagName, ok: box ? getComputedStyle(box).boxShadow.includes('1.5px') : cs.outlineStyle === 'solid' && cs.outlineWidth === '2px', color: cs.outlineColor } })
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); const f = await focus(); if (!f.inWin) { if (seen.size) break; continue } expect(f.ok).toBe(true); seen.add(f.kind) }
  for (const kind of ['ban-field', 'ban-select-value', 'ban-toggle']) expect(seen.has(kind)).toBe(true)
  await page.locator('#win-light [role=tab]').first().focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(2000)
  const d = page.locator('#win-light .ban-drop'); await expect(d).toHaveAttribute('data-state', 'message')
  await d.locator('.ban-drop-text').focus(); expect((await focus()).color).toBe('rgb(236, 236, 234)')
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await expect(d).toHaveAttribute('data-state', 'rest')
})
test('кольцо на тихой кнопке видно с клавиатуры', async ({ page }) => {
  await page.goto('/demo/settings.html'); await page.locator('#win-light [role=tab]').first().focus()
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.press('Tab')
  const quiet = page.locator('#win-light .ban-button'); await expect(quiet).toBeFocused(); await expect(quiet).toHaveText('Проверить')
  const ring = await quiet.evaluate(e => { const cs = getComputedStyle(e); return [cs.outlineStyle, cs.outlineWidth] })
  expect(ring).toEqual(['solid', '2px'])
})
test('тёмное окно проходится клавишами', async ({ page }) => {
  await page.goto('/demo/settings.html'); const seen = new Set<string>()
  const focus = () => page.evaluate(() => { const e = document.activeElement as HTMLElement, cs = getComputedStyle(e), box = e.closest('.ban-field-box')
    return { inWin: !!e.closest('#win-dark'), kind: e.classList[0] ?? e.getAttribute('role') ?? e.tagName, ok: box ? getComputedStyle(box).boxShadow.includes('1.5px') : cs.outlineStyle === 'solid' && cs.outlineWidth === '2px', color: cs.outlineColor } })
  for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); const f = await focus(); if (!f.inWin) { if (seen.size) break; continue } expect(f.ok).toBe(true); seen.add(f.kind) }
  for (const kind of ['ban-field', 'ban-select-value', 'ban-toggle']) expect(seen.has(kind)).toBe(true)
  await page.locator('#win-dark [role=tab]').first().focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(2000)
  const d = page.locator('#win-dark .ban-drop'); await expect(d).toHaveAttribute('data-state', 'message')
  await d.locator('.ban-drop-text').focus(); expect((await focus()).color).toBe('rgb(17, 17, 17)')
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await expect(d).toHaveAttribute('data-state', 'rest')
})
