// Finds in pages and components what banui forbids and a pattern can see.
//   node scripts/check.mjs <file or folder>...
// Prints `file:line  rule  what to do` for every hit and exits 1 when there is any. A hit is fixed,
// or shown to the owner with the reason it stays. What only an eye can judge is in SKILL.md, "Before showing".
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const KINDS = ['.html', '.css', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue', '.svelte', '.astro']
const SKIP = ['node_modules', 'kit', 'dist', '.git', '.next']
const SIZES = ['12px', '13px', '17px', 'inherit']

/** Rules that hold on any line. A rule: its name, what to look for, what to do instead.
 *  Black with an alpha passes the color rule: it is the window's shadow. */
const ANYWHERE = [
  ['color', /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6})\b/i, 'a color written by hand: use var(--ban-<token>)'],
  ['color', /\b(?:rgb|hsl)a?\((?!\s*0[\s,]+0[\s,]+0\b)|\b(?:hwb|lab|lch|oklab|oklch)\(/i, 'a color written by hand: use var(--ban-<token>)'],
  ['color', /\b(?:color|background|background-color|border-color|outline-color|fill|stroke)\s*:\s*['"]?(?:red|green|blue|white|black|gr[ae]y|orange|yellow|purple|pink)\b/i, 'a named color: use var(--ban-<token>)'],
  ['gradient', /\b(?:linear|radial|conic)-gradient\(/i, 'a gradient: surfaces are flat tokens'],
  ['dialog', /<dialog\b|role=["'](?:alert)?dialog["']|aria-modal|showModal\(|\bmodal\b/i, 'a modal or dialog: ask in a tray that grows out of the pressed control'],
  ['toast', /toast|snackbar|sonner/i, 'a toast: one status drop per window, closed by the person'],
  ['spinner', /spinner|skeleton|shimmer|animate-spin|animate-pulse|rotate\((?:360deg|1turn)\)/i, 'a spinner or skeleton: waiting is three breathing dots that become the result'],
  ['icon', /from\s+['"](?:lucide-react|react-icons|@heroicons|@phosphor-icons|@tabler\/icons|@fortawesome|@mui\/icons-material|@radix-ui\/react-icons)/, 'an icon set: a glyph is two or three lines'],
  ['icon', /<svg\b(?![^>]*\bban-pen\b)/, 'a drawn icon: a glyph is two or three .ban-ln lines; an svg is for the pen stroke only'],
  ['icon', /[✨\u{1FA84}]/u, 'sparkles: the answer simply appears'],
  ['text-size', /\bfont-size\s*:\s*(?!var\()([^;}"'!]+)/i, 'a third text size: 13 px and 12 px only (17 px for the hand note)', value => !SIZES.includes(value.trim())],
  ['text-size', /\bfontSize\s*:\s*['"]?(\d+(?:\.\d+)?)/, 'a third text size: 13 px and 12 px only (17 px for the hand note)', value => !['12', '13', '17'].includes(value)],
  ['text-size', /\btext-(?:xs|sm|base|lg|[2-9]?xl)\b/, 'a type scale of another system: 13 px and 12 px only'],
]

/** Short colors are told from ids and anchors only inside a stylesheet. */
const IN_STYLES = [
  ['color', /(?<![&\w])#(?:[0-9a-f]{3,4})\b/i, 'a color written by hand: use var(--ban-<token>)'],
]

function files(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path, { withFileTypes: true })
    .filter(entry => !SKIP.includes(entry.name))
    .flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : KINDS.includes(extname(entry.name)) ? [join(path, entry.name)] : [])
}

function check(file) {
  const hits = []
  let styles = extname(file) === '.css'
  readFileSync(file, 'utf8').split('\n').forEach((line, n) => {
    if (/<style\b/i.test(line)) styles = true
    for (const [rule, pattern, advice, wrong] of styles ? [...ANYWHERE, ...IN_STYLES] : ANYWHERE) {
      const match = pattern.exec(line)
      if (match && (!wrong || wrong(match[1]))) hits.push(`${file}:${n + 1}  ${rule}  ${advice}`)
    }
    if (/<\/style>/i.test(line)) styles = false
  })
  return hits
}

const asked = process.argv.slice(2)
if (!asked.length) {
  console.error('usage: node scripts/check.mjs <file or folder>...')
  process.exit(2)
}
const checked = asked.flatMap(files)
const hits = [...new Set(checked.flatMap(check))]
for (const hit of hits) console.error(hit)
if (!hits.length) console.log(`${checked.length} file${checked.length === 1 ? '' : 's'} checked, nothing found`)
process.exit(hits.length ? 1 : 0)
