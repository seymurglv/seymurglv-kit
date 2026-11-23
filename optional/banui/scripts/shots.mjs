// Writes assets/settings-light.png and assets/settings-dark.png: the settings example in each theme,
// at scale 2, cropped tight around its window. Uses the running dev server or starts one for the run.
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = 'http://127.0.0.1:5179/skills/banui/examples/screen-settings/index.html'
const MARGIN = 16
const BELOW = 32 // room for the window's shadow

async function running() {
  try { return (await fetch(PAGE)).ok } catch { return false }
}

const server = (await running()) ? null : await createServer({ root, logLevel: 'silent' })
await server?.listen()

const browser = await chromium.launch()
try {
  mkdirSync(resolve(root, 'assets'), { recursive: true })
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: theme })
    await page.goto(PAGE)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(800)
    const box = await page.locator('.win').boundingBox()
    if (!box) throw new Error(`no window for ${theme}`)
    const path = resolve(root, 'assets', `settings-${theme}.png`)
    await page.screenshot({
      path,
      clip: { x: box.x - MARGIN, y: box.y - MARGIN, width: box.width + 2 * MARGIN, height: box.height + MARGIN + BELOW },
    })
    console.log(path)
    await page.close()
  }
} finally {
  await browser.close()
  await server?.close()
}
