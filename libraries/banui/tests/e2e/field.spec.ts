import { test, expect, type Locator } from '@playwright/test'
import { size, css } from './util'

/** Waits until the element's transitions have finished. */
const settle = (l: Locator): Promise<unknown> => l.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))

test('покой, ввод, готово', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#f-mail').locator('xpath=..')
  await expect(box).toHaveAttribute('data-state', 'done')
  expect(await size(box)).toEqual([220, 28])
  expect(await css(box.locator('.ban-field-sign'), 'background-color')).toBe('rgb(11, 107, 91)')   // done на карточке
  expect(await size(box.locator('.ban-field-sign'))).toEqual([3, 3])
  await page.locator('#f-mail').focus(); await expect(box).toHaveAttribute('data-state', 'typing')
  await settle(box.locator('.ban-field-sign'))
  expect(await size(box.locator('.ban-field-sign'))).toEqual([2, expect.closeTo(10.1, 0)])
})
test('ошибка: янтарная лампа, штрих, пометка, цвет текста и обводки прежний', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const input = page.locator('#f-mail'), box = input.locator('xpath=..')
  await input.fill('anna.mail.ru'); await input.blur()
  await expect(box).toHaveAttribute('data-state', 'error'); await expect(box.locator('.ban-note')).toHaveText('нужна @')
  expect(await css(box.locator('.ban-field-sign'), 'background-color')).toBe('rgb(189, 115, 19)')
  expect(await css(input, 'color')).toBe('rgb(17, 17, 17)'); await expect(input).toHaveAttribute('aria-invalid', 'true')
  await input.focus(); await expect(box).toHaveAttribute('data-state', 'error')          // держится в фокусе
  await input.press('End'); await input.type('x'); await expect(box).toHaveAttribute('data-state', 'typing')
})
test('кириллица сразу после фокуса встаёт по порядку', async ({ page }) => {
  await page.goto('/demo/specimen.html'); await page.locator('#f-plain').fill('')
  await page.locator('#f-plain').focus(); await page.keyboard.insertText('о'); await page.keyboard.insertText('т'); await page.keyboard.insertText('чёт')
  await expect(page.locator('#f-plain')).toHaveValue('отчёт')
})
test('крайние значения', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const input = page.locator('#f-mail'), box = input.locator('xpath=..')
  await input.fill(''); await input.blur(); await expect(box.locator('.ban-note')).toHaveText('нужна почта')
  expect(Number(await box.locator('.ban-pen').getAttribute('width'))).toBeGreaterThanOrEqual(14)
  await input.fill('оченьдлинныйадресбезсобачкикоторыйнепомещаетсявполе'); await input.blur()
  expect(Number(await box.locator('.ban-pen').getAttribute('width'))).toBeLessThanOrEqual(220 - 26 - 28)
})
test('пометка ошибки не попадает в имя поля', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  await page.evaluate(async () => {
    const url = '/src/controls/field/field.ts'; const { field } = await import(url)
    const wrap = document.createElement('div'); wrap.id = 'f-named-host'
    const label = document.createElement('label'); label.htmlFor = 'f-named'; label.textContent = 'Почта'
    const i = document.createElement('input'); i.className = 'ban-field'; i.id = 'f-named'
    wrap.append(label, i); document.querySelector('#s-signs')!.append(wrap)
    field(i).setError('нужна @')
  })
  const named = page.locator('#f-named-host').getByRole('textbox', { name: 'Почта', exact: true })
  await expect(named).toHaveAttribute('id', 'f-named')
  await expect(named).toHaveAccessibleDescription(/нужна @/)
  await page.evaluate(() => document.querySelector('#f-named-host')!.remove())
  expect(await page.locator('#s-field .ban-field-box').count()).toBe(2)
})
test('достройка не меняет размер и не удваивается', async ({ page }) => {
  await page.goto('/demo/specimen.html')
  expect(await page.evaluate(async () => { const url = '/src/controls/field/field.ts'; const { field } = await import(url); const host = document.querySelector('#s-field')!; const i = document.createElement('input'); i.className = 'ban-field'; host.append(i)
    const r0 = i.getBoundingClientRect(), before = [r0.width, r0.height], r1 = field(i).box.getBoundingClientRect(); i.closest('.ban-field-box')!.remove(); return [before, [r1.width, r1.height]] })).toEqual([[220, 28], [220, 28]])
  expect(await page.evaluate(async () => { const url = '/src/controls/field/field.ts'; const { field } = await import(url); const el = document.querySelector('#f-plain') as HTMLInputElement; return [field(el) === field(el), document.querySelectorAll('#s-field .ban-field-box').length] })).toEqual([true, 2])
})
test('штрих в покое не выходит за поле', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const box = page.locator('#f-plain').locator('xpath=..')
  const b = (await box.boundingBox())!, pen = (await box.locator('.ban-pen').boundingBox())!
  expect(pen.x + pen.width).toBeLessThanOrEqual(b.x + b.width)
})
test('обводка фокуса появляется сразу', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const input = page.locator('#f-plain')
  expect(await input.evaluate(e => { (e as HTMLElement).focus(); return getComputedStyle(e.parentElement!).boxShadow })).toContain('1.5px')
})
