import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Vision = 'normal' | 'deutan' | 'protan' | 'tritan'
type Vec3 = [number, number, number]

/** Hex colour (#RGB or #RRGGBB) to sRGB channels in 0..1. */
function parseHex(hex: string): Vec3 {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a hex colour: ${hex}`)
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as Vec3
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const linear = (hex: string) => parseHex(hex).map(toLinear) as Vec3

function toHex(rgb: Vec3): string {
  return '#' + rgb
    .map(c => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

const mul = (m: readonly Vec3[], v: Vec3) =>
  m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3

/** WCAG 2 contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = linear(hex)
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SRGB_TO_XYZ: readonly Vec3[] = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
]
const D65: Vec3 = [0.95047, 1, 1.08883]

function lab(hex: string): Vec3 {
  const xyz = mul(SRGB_TO_XYZ, linear(hex))
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = xyz.map((v, i) => f(v / D65[i]))
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** CIEDE2000 colour difference between two hex colours (sRGB, D65). */
export function deltaE00(a: string, b: string): number {
  const [L1, a1, b1] = lab(a)
  const [L2, a2, b2] = lab(b)
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar7 = ((C1 + C2) / 2) ** 7
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const hue = (bb: number, ap: number) => {
    if (bb === 0 && ap === 0) return 0
    const h = deg(Math.atan2(bb, ap))
    return h < 0 ? h + 360 : h
  }
  const h1p = hue(b1, a1p)
  const h2p = hue(b2, a2p)

  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2))

  const Lbp = (L1 + L2) / 2
  const Cbp = (C1p + C2p) / 2
  let hbp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
  }

  const T = 1
    - 0.17 * Math.cos(rad(hbp - 30))
    + 0.24 * Math.cos(rad(2 * hbp))
    + 0.32 * Math.cos(rad(3 * hbp + 6))
    - 0.2 * Math.cos(rad(4 * hbp - 63))
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2))
  const Cbp7 = Cbp ** 7
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2)
  const Sc = 1 + 0.045 * Cbp
  const Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc

  const l = dLp / Sl
  const c = dCp / Sc
  const h = dHp / Sh
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h)
}

/** Full-severity colour vision matrices applied to linear RGB. */
const VISION: Record<Exclude<Vision, 'normal'>, readonly Vec3[]> = {
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}

/** How a hex colour looks under the given vision type, as hex. */
export function simulate(hex: string, vision: Vision): string {
  if (vision === 'normal') return toHex(parseHex(hex))
  const out = mul(VISION[vision], linear(hex)).map(c => toGamma(Math.min(1, Math.max(0, c)))) as Vec3
  return toHex(out)
}

/** Declarations of every rule in src/tokens.css whose selector matches exactly. Throws if no rule has that selector. */
export function declarations(selector: string): Record<string, string> {
  const tokensCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../src/tokens.css'), 'utf8')
  const css = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '')
  const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim()
  const out: Record<string, string> = {}
  let found = false
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (norm(sel) !== selector) continue
    found = true
    for (const [, name, value] of body.matchAll(/(--ban-[\w-]+)\s*:\s*([^;]+);?/g)) out[name] = value.trim()
  }
  if (!found) throw new Error(`Selector not found in src/tokens.css: ${selector}`)
  return out
}

/** The --ban-* tokens that apply in the given theme, read from src/tokens.css. */
export function readTokens(theme: 'light' | 'dark'): Record<string, string> {
  const own = theme === 'light' ? ':root, [data-theme="light"]' : '[data-theme="dark"]'
  return { ...declarations(':root'), ...declarations(own) }
}
