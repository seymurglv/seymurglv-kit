import { test, expect } from '@playwright/test'
import { css } from './util'

test('недоступная тихая кнопка: обводка line, подпись muted', async ({ page }) => {
  await page.goto('/demo/specimen.html'); const button = page.locator('#b-quiet')
  for (const off of ['disabled', 'aria-disabled'] as const) {
    await button.evaluate((el, name) => { el.removeAttribute('disabled'); el.removeAttribute('aria-disabled'); el.setAttribute(name, name === 'disabled' ? '' : 'true') }, off)
    expect(await css(button, 'color'), off).toBe('rgb(107, 107, 103)')              // muted
    expect(await css(button, 'box-shadow'), off).toContain('rgb(236, 236, 233)')    // line
    expect(await css(button, 'cursor'), off).toBe('default')
  }
})
