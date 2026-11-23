import type { Locator } from '@playwright/test'

const round = (n: number): number => Math.round(n * 10) / 10

/** Width and height of the rendered box (after transforms), rounded to 0.1 px. */
export async function size(locator: Locator): Promise<[number, number]> {
  const r = await locator.evaluate(el => {
    const b = el.getBoundingClientRect()
    return [b.width, b.height]
  })
  return [round(r[0]), round(r[1])]
}

/** Computed value of one CSS property. */
export async function css(locator: Locator, prop: string): Promise<string> {
  return locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
}
