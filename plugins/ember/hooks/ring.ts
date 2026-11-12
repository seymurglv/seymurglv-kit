// The ring: minutes until the cache goes cold, ember's one signature element.
// A 34px Svg: a track, an arc for the share of the TTL left, and the minutes in
// Bebas Neue, drawn from the glyph outlines in digits.ts so it needs no font.
// Colors are the palette's tokens, light and dark, chosen by the media query.

import { DIGIT_CAP, DIGIT_EM, DIGITS } from './digits'

export type RingTone = 'ok' | 'warn' | 'idle'

const SIZE = 34
const R = 14
const STROKE = 2.5
const CIRCUMFERENCE = 2 * Math.PI * R
const FONT_PX = 15

// The palette: --ok, --warn, --faint, --line and --text, light then dark.
const LIGHT = { ok: '#1E9E5A', warn: '#EE9A00', idle: '#C4C4C0', track: '#ECECE9', text: '#111111' }
const DARK = { ok: '#33C27A', warn: '#F5B82E', idle: '#4A4A4E', track: '#232326', text: '#ECECEA' }

function number(value: number): string {
  if (value < 0) return ''
  const text = String(Math.max(0, Math.min(99, Math.floor(value))))
  const scale = FONT_PX / DIGIT_EM
  const width = [...text].reduce((sum, ch) => sum + (DIGITS[ch]?.width ?? 0), 0) * scale
  // Centre the cap height on the ring's centre.
  const baseline = SIZE / 2 + (DIGIT_CAP * scale) / 2
  let x = SIZE / 2 - width / 2
  const glyphs: string[] = []
  for (const ch of text) {
    const glyph = DIGITS[ch]
    if (glyph === undefined) continue
    glyphs.push(
      `<path class="n" transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)}) scale(${scale})" d="${glyph.path}"/>`,
    )
    x += glyph.width * scale
  }
  return glyphs.join('')
}

/**
 * The ring's SVG document for `share` of the TTL left and `minutes` in the
 * middle; negative `minutes` leave the middle empty (a cold cache).
 */
export function ringSvg(share: number, minutes: number, tone: RingTone): string {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, share)))
  const c = SIZE / 2
  const style =
    `.t{stroke:${LIGHT.track}}.a{stroke:${LIGHT[tone]}}.n{fill:${LIGHT.text}}` +
    `@media (prefers-color-scheme:dark){.t{stroke:${DARK.track}}.a{stroke:${DARK[tone]}}.n{fill:${DARK.text}}}`
  const arc =
    share > 0
      ? `<circle class="a" cx="${c}" cy="${c}" r="${R}" fill="none" stroke-width="${STROKE}" stroke-linecap="round" stroke-dasharray="${CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`
      : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<style>${style}</style>` +
    `<circle class="t" cx="${c}" cy="${c}" r="${R}" fill="none" stroke-width="${STROKE}"/>` +
    arc +
    number(minutes) +
    `</svg>`
  )
}

export const RING_PX = SIZE
