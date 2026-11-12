// Builds the stylesheets.
//   node scripts/build-css.mjs                 writes dist/banui.css, dist/fonts/ and skills/banui/banui.css
//   node scripts/build-css.mjs --out <dir>     writes only <dir>/banui.css and <dir>/fonts/
//   node scripts/build-css.mjs --print-skill   prints the skill starter and writes nothing
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'src')
const FONTS = ['caveat-latin-600.woff2', 'caveat-cyrillic-600.woff2', 'OFL.txt']

const SKILL_HEADER = `/* banui starter: tokens and the five signs.
   Copy into the page as is. Do not rename tokens or re-pick values. */
`

const read = file => readFileSync(file, 'utf8')

/** The file with every @import expanded in place and every url() made relative to src/. */
function flatten(file) {
  const dir = dirname(file)
  return read(file)
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (whole, q, url) => {
      if (/^(data:|[a-z]+:\/\/|\/|#)/i.test(url)) return whole
      return `url(${q}./${relative(src, resolve(dir, url)).split('\\').join('/')}${q})`
    })
    .replace(/@import\s+["']([^"']+)["']\s*;\s*\n?/g, (_, path) =>
      `${flatten(resolve(dir, path)).trim()}\n\n`)
}

function libraryCss() {
  return `${flatten(resolve(src, 'banui.css')).trim()}\n`
}

/** The starter the skill ships: tokens, signs, the pen without its fonts, and the hand-kept extras. */
function skillCss() {
  const pen = read(resolve(src, 'pen/pen.css'))
    .replace(/@font-face\s*\{[^}]*\}\s*/g, '')
  const parts = [
    SKILL_HEADER,
    read(resolve(src, 'tokens.css')),
    read(resolve(src, 'signs.css')),
    pen,
    read(resolve(root, 'scripts/skill-starter-extras.css')),
  ]
  return `${parts.map(p => p.trim()).join('\n\n')}\n`
}

function writeLibrary(out) {
  mkdirSync(resolve(out, 'fonts'), { recursive: true })
  writeFileSync(resolve(out, 'banui.css'), libraryCss())
  for (const f of FONTS) copyFileSync(resolve(src, 'fonts', f), resolve(out, 'fonts', f))
}

const args = process.argv.slice(2)
if (args.includes('--print-skill')) {
  process.stdout.write(skillCss())
} else if (args.includes('--out')) {
  const out = args[args.indexOf('--out') + 1]
  if (!out) throw new Error('--out needs a folder')
  writeLibrary(resolve(out))
} else {
  writeLibrary(resolve(root, 'dist'))
  writeFileSync(resolve(root, 'skills/banui/banui.css'), skillCss())
}
