import { test, expect } from '@playwright/test'
import { size, css } from './util'

test('точка 3×3, линия 2×14, лампа 3×3', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await size(page.locator('#s-signs .dot'))).toEqual([3, 3])
  expect(await size(page.locator('#s-signs .line'))).toEqual([2, 14])
  expect(await size(page.locator('#lamp-cap'))).toEqual([3, 3])
  expect(await css(page.locator('#s-signs .dot'), 'border-top-left-radius')).not.toBe('0px')
})
test('кнопка возвращается пружиной за 260 мс, карточка складывается и гаснет', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  const made = await page.locator('.ban').first().evaluate(async root => {
    const button = document.createElement('button'); button.className = 'ban-button'; button.textContent = 'Да'
    const card = document.createElement('div'); card.className = 'ban-fold'; card.innerHTML = '<div style="height:40px">Карточка</div>'
    root.append(button, card)
    const back = getComputedStyle(button).transitionDuration
    const before = card.offsetHeight
    card.style.height = `${before}px`; void card.offsetHeight
    card.dataset.gone = ''; card.style.height = '0px'
    await new Promise(done => setTimeout(done, 450))
    const cs = getComputedStyle(card)
    return { back, before, after: card.offsetHeight, opacity: cs.opacity, fold: cs.transitionDuration }
  })
  expect(made.back).toBe('0.26s')
  expect(made.before).toBeGreaterThan(20)
  expect(made.after).toBe(0)
  expect(made.opacity).toBe('0')
  expect(made.fold).toBe('0.32s, 0.32s, 0.18s')
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
