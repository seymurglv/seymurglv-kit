import { test, expect } from '@playwright/test'
import { css } from './util'

test('дорожка 28, бегунок под выбранной подписью', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const n = page.locator('#s-nav .ban-nav').first()
  expect((await n.boundingBox())!.height).toBe(28)
  const tab = (await n.getByRole('tab').first().boundingBox())!, th = (await n.locator('.ban-nav-thumb').boundingBox())!
  expect(th.width).toBeCloseTo(tab.width, 0); expect(th.x).toBeCloseTo(tab.x, 0)
})
test('высота идёт в одну сторону, без перелёта, и снимается', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const n = page.locator('#s-nav .ban-nav').first()
  const panels = page.locator('#s-nav [role=tabpanel]').first().locator('xpath=..'), h = async () => (await panels.boundingBox())!.height
  expect(await h()).toBe(200); await n.getByRole('tab').nth(2).click()
  const seen: number[] = []; for (let i = 0; i < 6; i++) { await page.waitForTimeout(50); seen.push(await h()) }
  expect(seen.every((v, i) => v <= (seen[i - 1] ?? 200) && v >= 60)).toBe(true)
  await page.waitForTimeout(120); expect(await h()).toBe(60); expect(await panels.evaluate(e => (e as HTMLElement).style.height)).toBe('')
})
test('невыбранные разделы inert; стрелки, Home и End', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const n = page.locator('#s-nav .ban-nav').first()
  expect(await page.locator('#s-nav [role=tabpanel]').nth(1).evaluate(e => (e as HTMLElement).inert)).toBe(true)
  await n.getByRole('tab').first().focus(); await page.keyboard.press('ArrowRight'); await expect(n.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End'); await expect(n.getByRole('tab').nth(2)).toBeFocused(); await page.keyboard.press('Home'); await expect(n.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true')
})
test('быстрые клики посреди перехода заканчиваются верной высотой', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const n = page.locator('#s-nav .ban-nav').first(), panels = page.locator('#s-nav [role=tabpanel]').first().locator('xpath=..')
  await n.getByRole('tab').nth(2).click(); await page.waitForTimeout(80); await n.getByRole('tab').nth(1).click(); await page.waitForTimeout(60); await n.getByRole('tab').nth(0).click()
  await page.waitForTimeout(450); expect((await panels.boundingBox())!.height).toBe(200); expect(await panels.evaluate(e => (e as HTMLElement).style.height)).toBe('')
})
test('длинные подписи прокручиваются внутри дорожки', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const long = page.locator('#nav-long')
  expect((await long.boundingBox())!.width).toBeLessThanOrEqual(300)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})
test('кольцо на выбранном разделе рисуется внутрь чернилами капсулы', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/demo/specimen.html'); const n = page.locator('#s-nav .ban-nav').first()
  await n.getByRole('tab').first().focus(); await page.keyboard.press('ArrowRight'); const tab = n.getByRole('tab').nth(1)
  await expect(tab).toBeFocused(); await expect(tab).toHaveAttribute('aria-selected', 'true')
  expect(await css(tab, 'outline-style')).toBe('solid'); expect(await css(tab, 'outline-width')).toBe('2px')
  expect(await css(tab, 'outline-offset')).toBe('-3px'); expect(await css(tab, 'outline-color')).toBe('rgb(236, 236, 234)')
})
test('без движения дорожка прокручивается сразу', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/demo/specimen.html'); const long = page.locator('#nav-long')
  await long.getByRole('tab').first().focus(); await page.keyboard.press('End')
  const now = await long.evaluate(e => e.scrollLeft); await page.waitForTimeout(400)
  expect(now).toBeGreaterThan(0); expect(now).toBe(await long.evaluate(e => e.scrollLeft))
})
test('выбор раздела прокручивает дорожку, а не страницу', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const long = page.locator('#nav-long')
  await long.getByRole('tab').first().focus(); const before = await page.evaluate(() => [scrollX, scrollY])
  await page.keyboard.press('End'); await page.waitForTimeout(600)
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual(before)
  const tab = (await long.getByRole('tab').last().boundingBox())!, track = (await long.boundingBox())!
  expect(tab.x).toBeGreaterThanOrEqual(track.x - 0.5); expect(tab.x + tab.width).toBeLessThanOrEqual(track.x + track.width + 0.5)
})
test('скрытый раздел не выходит за контейнер', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  const r = await page.evaluate(async () => {
    const url = '/src/controls/nav/nav.ts'; const { nav } = await import(url)
    const main = document.querySelector('main')!, wrap = document.createElement('div')
    wrap.innerHTML = '<div class="ban-nav" role="tablist" aria-label="Тест"><button type="button" role="tab" aria-controls="tp-a" aria-selected="true" tabindex="0">А</button><button type="button" role="tab" aria-controls="tp-b" aria-selected="false" tabindex="-1">Б</button></div>'
      + '<div id="tp-box"><div role="tabpanel" id="tp-a" style="height: 200px">А</div><div role="tabpanel" id="tp-b" style="height: 60px" inert>Б</div></div>'
    main.append(wrap); const c = nav(wrap.firstElementChild as HTMLElement)
    const content = () => main.getBoundingClientRect().bottom + scrollY
    const start = document.documentElement.scrollHeight
    c.select(1); await new Promise(res => setTimeout(res, 450))
    const box = document.querySelector('#tp-box')!.getBoundingClientRect().bottom
    return { box, inert: [...document.querySelectorAll('#tp-box > [inert]')].map(p => p.getBoundingClientRect().bottom), scroll: document.documentElement.scrollHeight, content: Math.ceil(content()), start }
  })
  for (const b of r.inert) expect(b).toBeLessThanOrEqual(r.box)
  expect(r.scroll).toBeLessThanOrEqual(r.content)
})
