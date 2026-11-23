import { expect, test } from 'vitest'
import { underlinePath, drawUnderline } from '../../src/pen/pen.js'

const ns = 'http://www.w3.org/2000/svg'
function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement
  svg.appendChild(document.createElementNS(ns, 'path'))
  return svg
}

test('путь постоянен для ширины', () => {
  expect(underlinePath(100)).toBe('M1 5C25 2 50 8 72 4S95 6 99 3')
  expect(underlinePath(100)).toBe(underlinePath(100))
})
test('ширина не меньше 14', () => { expect(underlinePath(3)).toBe(underlinePath(14)) })
test('числа без хвостовых нулей, не больше двух знаков', () => {
  expect(underlinePath(37)).toBe('M1 5C9.25 2 18.5 8 26.64 4S32 6 36 3')
})
test('drawUnderline ставит width и d', () => {
  const svg = makeSvg()
  drawUnderline(svg, 3)
  expect(svg.getAttribute('width')).toBe('14')
  expect(svg.querySelector('path')!.getAttribute('d')).toBe(underlinePath(14))
  drawUnderline(svg, 100)
  expect(svg.getAttribute('width')).toBe('100')
  expect(svg.querySelector('path')!.getAttribute('d')).toBe('M1 5C25 2 50 8 72 4S95 6 99 3')
})
test('drawUnderline ставит pathLength=1', () => {
  const svg = makeSvg()
  drawUnderline(svg, 100)
  expect(svg.querySelector('path')!.getAttribute('pathLength')).toBe('1')
})
test('нечисловая ширина считается как 14', () => {
  expect(underlinePath(NaN)).toBe(underlinePath(14))
  expect(underlinePath(Infinity)).toBe(underlinePath(14))
  const svg = makeSvg()
  drawUnderline(svg, NaN)
  expect(svg.getAttribute('width')).toBe('14')
  expect(svg.querySelector('path')!.getAttribute('d')).toBe(underlinePath(14))
})
