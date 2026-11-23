import { expect, test } from 'vitest'
import { contrast, declarations, deltaE00, readTokens, simulate, type Vision } from './color-math.js'

const kinds = ['done', 'error', 'rec', 'attention'] as const
for (const theme of ['light', 'dark'] as const) {
  const t = readTokens(theme)
  test(`${theme}: каждый тон лампы не ниже 3:1 на своей поверхности`, () => {
    for (const k of kinds) {
      expect(contrast(t[`--ban-${k}-cap`], t['--ban-cap'])).toBeGreaterThanOrEqual(3)
      expect(contrast(t[`--ban-${k}-card`], t['--ban-card'])).toBeGreaterThanOrEqual(3)
      expect(contrast(t[`--ban-${k}-card`], t['--ban-bg'])).toBeGreaterThanOrEqual(3)
    }
  })
  test(`${theme}: текст и второй текст не ниже 4,5:1`, () => {
    for (const ink of ['--ban-text', '--ban-muted']) for (const bg of ['--ban-bg', '--ban-card'])
      expect(contrast(t[ink], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
}
test('тона светлой поверхности различимы при любом зрении, ΔE не ниже 15', () => {
  const t = readTokens('light'); const deep = kinds.map(k => t[`--ban-${k}-card`])
  const worst = (v: Vision) => Math.min(...deep.flatMap((a, i) => deep.slice(i + 1).map(b => deltaE00(simulate(a, v), simulate(b, v)))))
  expect(worst('normal')).toBeCloseTo(28.4, 0); expect(worst('deutan')).toBeCloseTo(19.7, 0)
  expect(worst('protan')).toBeCloseTo(19.9, 0); expect(worst('tritan')).toBeCloseTo(19.1, 0)
  for (const v of ['normal', 'deutan', 'protan', 'tritan'] as Vision[]) expect(worst(v)).toBeGreaterThanOrEqual(15)
})
test('опорные значения', () => {
  expect(contrast('#BD7313', '#ECECEA')).toBeCloseTo(3.16, 1)
  expect(deltaE00('#BD7313', '#9E1708')).toBeCloseTo(28.4, 0)
})
test('тёмные значения по умолчанию совпадают с [data-theme="dark"]', () => {
  const byDefault = declarations(':root:not([data-theme="light"])')
  expect(Object.keys(byDefault).length).toBeGreaterThan(0)
  expect(byDefault).toEqual(declarations('[data-theme="dark"]'))
})
