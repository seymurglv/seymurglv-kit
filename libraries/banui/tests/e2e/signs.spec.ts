import { test, expect } from '@playwright/test'
import { size, css } from './util'

test('точка 3×3, линия 2×14, лампа 3×3', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await size(page.locator('#s-signs .dot'))).toEqual([3, 3])
  expect(await size(page.locator('#s-signs .line'))).toEqual([2, 14])
  expect(await size(page.locator('#lamp-cap'))).toEqual([3, 3])
  expect(await css(page.locator('#s-signs .dot'), 'border-top-left-radius')).not.toBe('0px')
})
test('тон лампы зависит от поверхности и темы', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/demo/specimen.html')
  expect(await css(page.locator('#lamp-cap'), 'background-color')).toBe('rgb(245, 184, 46)')   // #F5B82E
  expect(await css(page.locator('#lamp-card'), 'background-color')).toBe('rgb(189, 115, 19)')  // #BD7313
  expect(await css(page.locator('#lamp-dark'), 'background-color')).toBe('rgb(158, 23, 8)')    // #9E1708
})
test('кнопка-капсула сохраняет чернила капсулы и 12 px', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await css(page.locator('#btn-cap'), 'color')).toBe('rgb(236, 236, 234)')
  expect(await css(page.locator('#btn-cap'), 'font-size')).toBe('12px')
})
test('тема, переключённая на ходу, меняет тон лампы без достройки', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/demo/specimen.html')
  await page.locator('#s-signs').evaluate(el => el.setAttribute('data-theme', 'dark'))
  expect(await css(page.locator('#lamp-cap'), 'background-color')).toBe('rgb(189, 115, 19)')
  expect(await css(page.locator('#lamp-card'), 'background-color')).toBe('rgb(245, 184, 46)')
})
test('кольцо .ban-ring на залитой капсуле рисуется её чернилами и при нажатии мышью', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/demo/specimen.html')
  await page.locator('#ring-cap').click()
  await page.locator('#ring-cap').evaluate(el => (el as HTMLElement).focus())   // WebKit does not focus a button on click
  expect(await css(page.locator('#ring-cap'), 'outline-color')).toBe('rgb(236, 236, 234)')
  expect(await css(page.locator('#ring-cap'), 'outline-offset')).toBe('-3px')
})
test('поддерево с data-theme получает свои чернила и фон', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/demo/specimen.html')
  await page.locator('#s-signs').evaluate(el => el.setAttribute('data-theme', 'dark'))
  expect(await css(page.locator('#s-signs'), 'color')).toBe('rgb(236, 236, 234)')
  expect(await css(page.locator('#s-signs'), 'background-color')).toBe('rgb(14, 14, 15)')
  expect(await css(page.locator('#s-signs .dot'), 'background-color')).toBe('rgb(236, 236, 234)')
})
test('без движения переходов нет', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/demo/specimen.html')
  expect(await css(page.locator('#s-signs .line'), 'transition-duration')).toBe('0s')
})
