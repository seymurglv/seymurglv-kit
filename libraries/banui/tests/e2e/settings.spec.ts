import { test, expect, type Locator } from '@playwright/test'

const H: Record<string, number> = { 'Общие': 327, 'Звук': 237, 'О программе': 192 }

for (const id of ['#win-light', '#win-dark']) for (const width of [1280, 390]) test.describe(`${id} ${width}`, () => {
  let win: Locator
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width, height: 900 }); await page.goto('/demo/settings.html'); win = page.locator(id) })

  test('высота окна по разделам, переход в одну сторону, под окнами ничего не едет', async ({ page }) => {
    const afterY = (await page.locator('#after').boundingBox())!.y; let prev = 327
    for (const name of ['О программе', 'Звук', 'Общие']) {
      await win.getByRole('tab', { name }).click(); const seen: number[] = []
      for (let i = 0; i < 6; i++) { await page.waitForTimeout(50); seen.push((await win.boundingBox())!.height) }
      const lo = Math.min(prev, H[name]), hi = Math.max(prev, H[name]); expect(seen.every(v => v >= lo - 0.5 && v <= hi + 0.5)).toBe(true)
      await page.waitForTimeout(60); expect((await win.boundingBox())!.height).toBe(H[name]); prev = H[name]
      const last = (await win.locator('[role=tabpanel]:not([inert]) .row').last().boundingBox())!, w = (await win.boundingBox())!
      expect(w.y + w.height - (last.y + last.height)).toBeLessThanOrEqual(12)
      expect((await page.locator('#after').boundingBox())!.y).toBe(afterY)
    }
  })
  test('неверная почта: ошибка, строка 66, пометка, окно выросло', async ({ page }) => {
    const mail = win.getByLabel('Почта'), note = mail.locator('xpath=..').locator('.ban-note')
    await mail.fill('anna.mail.ru'); await win.locator('.win-title').click(); await page.waitForTimeout(500)
    await expect(note).toHaveText('нужна @'); expect((await mail.locator('xpath=ancestor::*[contains(@class,"row")]').boundingBox())!.height).toBe(66)
    expect((await win.boundingBox())!.height).toBe(348)
    await mail.fill('anna@mail'); await win.locator('.win-title').click(); await expect(note).toHaveText('адрес не дописан')
  })
  test('пустая почта: пометка «нужна почта»', async () => {
    const mail = win.getByLabel('Почта'); await mail.fill(''); await win.locator('.win-title').click()
    await expect(mail.locator('xpath=..').locator('.ban-note')).toHaveText('нужна почта')
  })
  test('смена языка: сообщение капли, заголовок не закрыт', async ({ page }) => {
    await win.getByRole('button', { name: 'Язык' }).click(); await win.getByRole('option', { name: 'English' }).click(); await page.waitForTimeout(600)
    const d = win.locator('.ban-drop'); await expect(d).toHaveAttribute('data-state', 'message'); await expect(d.locator('.ban-drop-text')).toHaveText('Сменится после перезапуска')
    const t = (await win.locator('.win-title').boundingBox())!; expect((await d.boundingBox())!.x).toBeGreaterThan(t.x + t.width)
  })
  test('проверка обновлений: думает 44, сообщение, крест, двойное нажатие', async ({ page }) => {
    await win.getByRole('tab', { name: 'О программе' }).click(); await page.waitForTimeout(400)
    const d = win.locator('.ban-drop'), go = win.getByRole('button', { name: 'Проверить' }); await go.click(); await go.click(); await page.waitForTimeout(500)
    await expect(d).toHaveAttribute('data-state', 'thinking'); expect((await d.boundingBox())!.width).toBe(44)
    await page.waitForTimeout(1500); await expect(d.locator('.ban-drop-text')).toHaveText('Есть версия 1.1'); await page.waitForTimeout(1500); await expect(d.locator('.ban-drop-text')).toHaveText('Есть версия 1.1')
    await d.locator('.ban-drop-close').click(); await page.waitForTimeout(500); expect((await d.boundingBox())!.width).toBe(24)
  })
  test('открытый список не обрезан и лежит поверх строк', async ({ page }) => {
    await win.getByRole('button', { name: 'Язык' }).click(); await page.waitForTimeout(400)
    const o = (await win.getByRole('option', { name: 'Español' }).boundingBox())!
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role=listbox]'), [o.x + 30, o.y + 10])).toBe(true)
  })
  test('нет горизонтальной прокрутки; кириллица по порядку', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    const name = win.getByLabel('Имя'); await name.fill(''); await name.focus(); for (const ch of 'отчёт') await page.keyboard.insertText(ch); await expect(name).toHaveValue('отчёт')
  })
  test('без движения всё так же работает', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload()
    await win.getByRole('tab', { name: 'Звук' }).click(); expect((await win.boundingBox())!.height).toBe(237)
  })
})
