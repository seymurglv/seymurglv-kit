import { test, expect } from '@playwright/test'
import { css, size } from './util'

test('покой 24×24, думает 44, сообщение под текст', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const d = page.locator('#d-drop')
  expect(await size(d)).toEqual([24, 24]); await page.locator('#d-think').click(); await page.waitForTimeout(500)
  expect(await size(d)).toEqual([44, 24]); await expect(d).toHaveAttribute('data-state', 'thinking')
  await page.locator('#d-att').click(); await page.waitForTimeout(600)
  const w = await d.evaluate(e => { const t = e.querySelector('.ban-drop-text') as HTMLElement; const c = document.createElement('canvas').getContext('2d')!; c.font = getComputedStyle(t).font; return Math.ceil(24 + c.measureText(t.textContent!).width + 26) })
  expect((await d.boundingBox())!.width).toBeCloseTo(w, 0); await expect(d.locator('.ban-drop-text')).toHaveText('Сменится после перезапуска')
  expect(await css(d.locator('.ban-lamp'), 'background-color')).toBe('rgb(92, 141, 255)')        // attention на капсуле, светлая тема
})
test('само не закрывается; крест возвращает покой и событие', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const d = page.locator('#d-drop'); await page.locator('#d-att').click()
  await page.waitForTimeout(4000); await expect(d).toHaveAttribute('data-state', 'message')
  await d.locator('.ban-drop-close').click(); await page.waitForTimeout(500); await expect(d).toHaveAttribute('data-state', 'rest'); expect(await size(d)).toEqual([24, 24])
})
test('длинное сообщение не закрывает заголовок', async ({ page }) => {
  await page.goto('/demo/specimen.html'); await page.locator('#d-long').click(); await page.waitForTimeout(600)
  const d = (await page.locator('#d-drop').boundingBox())!, t = (await page.locator('#d-title').boundingBox())!
  expect(d.width).toBeLessThanOrEqual(400 - 112); expect(d.x).toBeGreaterThan(t.x + t.width)
})
test('второе сообщение поверх первого заканчивается своим текстом', async ({ page }) => {
  await page.goto('/demo/specimen.html'); await page.locator('#d-two').click(); await page.waitForTimeout(1200)
  await expect(page.locator('#d-drop .ban-drop-text')).toHaveText('Есть версия 1.1')
  await expect(page.locator('#d-drop .ban-drop-live')).toHaveText('Есть версия 1.1')
})
test('в покое кнопки капли не в обходе; достройка не удваивается', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await page.locator('#d-drop button').evaluateAll(bs => bs.every(b => (b as HTMLElement).tabIndex === -1))).toBe(true)
  expect(await page.evaluate(async () => { const url = '/src/controls/drop/drop.ts'; const { drop } = await import(url); const el = document.querySelector('#d-drop') as HTMLElement; return [drop(el) === drop(el), el.querySelectorAll('.ban-lamp').length] })).toEqual([true, 1])
})
test('кольцо на кнопках капли рисуется внутрь чернилами капсулы', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/demo/specimen.html')
  await page.locator('#d-att').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#d-drop')).toHaveAttribute('data-state', 'message')
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); const text = page.locator('#d-drop .ban-drop-text')
  await expect(text).toBeFocused()
  expect(await css(text, 'outline-style')).toBe('solid'); expect(await css(text, 'outline-width')).toBe('2px')
  expect(await css(text, 'outline-offset')).toBe('-3px'); expect(await css(text, 'outline-color')).toBe('rgb(236, 236, 234)')
})
test('сообщение подстраивается, когда окно сужается', async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 720 }); await page.goto('/demo/specimen.html')
  await page.locator('#d-long').click(); await page.waitForTimeout(600)
  await page.locator('#d-win').evaluate(e => { (e as HTMLElement).style.width = '300px' }); await page.waitForTimeout(600)
  const d = (await page.locator('#d-drop').boundingBox())!, t = (await page.locator('#d-title').boundingBox())!
  expect(d.width).toBeLessThanOrEqual(300 - 112); expect(d.x).toBeGreaterThan(t.x + t.width)
})
test('без движения капля меняется сразу', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/demo/specimen.html'); const d = page.locator('#d-drop')
  await page.locator('#d-think').click(); await page.waitForTimeout(50)
  expect(await size(d)).toEqual([44, 24])
  await page.locator('#d-att').click(); await page.waitForTimeout(50)
  const w = await d.evaluate(e => { const t = e.querySelector('.ban-drop-text') as HTMLElement; const c = document.createElement('canvas').getContext('2d')!; c.font = getComputedStyle(t).font; return Math.ceil(24 + c.measureText('Сменится после перезапуска').width + 26) })
  expect((await d.boundingBox())!.width).toBeCloseTo(w, 0)
  expect(await d.locator('.ban-drop-text').textContent()).toBe('Сменится после перезапуска')
  const lamp = d.locator('.ban-lamp'); await expect(lamp).toHaveAttribute('data-kind', 'attention')
  expect(await css(lamp, 'animation-name')).toBe('none'); expect(await lamp.evaluate(e => e.getAnimations().length)).toBe(0)
})
