// Builds the showcase as one HTML file for a private page host: node showcase/board.mjs
// Output: probes/.board/board.html (not tracked). Every thing is inlined as a whole page and shown in a frame.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { collect } from './collect.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap'
const LIMIT = 16_000_000

const read = file => readFileSync(file, 'utf8')
const local = ref => !/^([a-z]+:|\/\/|#)/i.test(ref)
const inScript = code => code.replace(/<\/script/gi, '<\\/script')

/** One module and everything it imports, as a single script text. */
async function bundle(entry) {
  const out = await build({
    root, configFile: false, logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, formats: ['es'], fileName: 'x' } },
  })
  const chunk = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk')
  return chunk.code
}

/** A stylesheet with its local font files dropped; the hand font comes from the font host instead. */
const css = file => read(file).replace(/@font-face\s*\{[^}]*\}\s*/g, '')

/** A thing's page with its own stylesheets and module scripts put inside it. */
async function inlinePage(dir) {
  let html = read(resolve(dir, 'index.html')), hand = false
  html = html.replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi, tag => {
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href || !local(href)) return tag
    const text = css(resolve(dir, href))
    hand ||= /Caveat/.test(text)
    return `<style>\n${text}\n</style>`
  })
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)].filter(m => local(m[1]))
  for (const m of scripts) html = html.replace(m[0], `<script type="module">\n${inScript(await bundle(resolve(dir, m[1])))}\n</script>`)
  if (hand && !html.includes('fonts.googleapis.com')) html = html.replace(/<\/head>|<body|$/i, tag => `<link rel="stylesheet" href="${FONTS}">${tag}`)
  return html
}

const probes = resolve(root, process.env.BANUI_PROBES ?? 'probes')
const items = []
for (const item of collect({ root, probes })) {
  const { dir, url, ...rest } = item
  items.push({ ...rest, html: await inlinePage(dir) })
}

const shell = [
  '<title>Доска banui</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<link rel="stylesheet" href="${FONTS}">`,
  `<style>\n${css(resolve(root, 'skills/banui/kit/banui.css'))}\n${read(resolve(root, 'showcase/showcase.css'))}\n</style>`,
  '<main class="ban page" id="app"></main>',
  `<script>window.__BANUI_ITEMS__ = ${JSON.stringify(items).replace(/</g, '\\u003c')}</script>`,
  `<script type="module">\n${inScript(await bundle(resolve(root, 'showcase/showcase.js')))}\n</script>`,
  '',
].join('\n')

const bytes = Buffer.byteLength(shell)
if (bytes > LIMIT) throw new Error(`board is ${bytes} bytes, over the ${LIMIT} limit`)
const out = resolve(probes, '.board')
if (!existsSync(probes)) throw new Error(`no probes folder at ${probes}: the board is a private page and is written there`)
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'board.html'), shell)
console.log(`${resolve(out, 'board.html')}  ${items.length} things, ${(bytes / 1024).toFixed(0)} KB`)
