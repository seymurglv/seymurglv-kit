import { test, expect } from '@playwright/test'
import { size } from './util'

test('размеры и знаки', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await size(page.locator('#t-on'))).toEqual([36, 20])
  expect(await size(page.locator('#t-on .ban-ln'))).toEqual([2, 10])
  expect(await size(page.locator('#t-off .ban-ln'))).toEqual([3, 3])
  expect(await size(page.locator('#b-quiet'))).toEqual([expect.any(Number), 24])
})
test('клик, Пробел и Enter переключают и сообщают событием', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  await page.evaluate(() => { (window as any).got = []; document.querySelector('#t-off')!.addEventListener('ban:change', e => (window as any).got.push((e as CustomEvent).detail.checked)) })
  await page.locator('#t-off').click(); await page.locator('#t-off').press('Space'); await page.locator('#t-off').press('Enter')
  expect(await page.evaluate(() => (window as any).got)).toEqual([true, false, true])
  await expect(page.locator('#t-off')).toHaveAttribute('aria-checked', 'true')
})
test('повторная достройка не удваивает знак', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await page.evaluate(async () => { const url = '/src/controls/toggle/toggle.ts'; const { toggle } = await import(url); const el = document.querySelector('#t-on') as HTMLButtonElement; const a = toggle(el), b = toggle(el); return [a === b, el.querySelectorAll('.ban-ln').length] })).toEqual([true, 1])
})
test('Tab доходит до переключателя', async ({ page }) => {
  await page.goto('/demo/specimen.html'); await page.locator('#t-on').focus(); await page.keyboard.press('Tab')
  await expect(page.locator('#t-off')).toBeFocused()
})
