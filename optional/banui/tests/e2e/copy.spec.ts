import { test, expect } from '@playwright/test'
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join, normalize, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
}

/** Serves the files of one folder and nothing else; a path that is not a file there is a 404. */
function serve(root: string): Promise<Server> {
  const server = createServer((req, res) => {
    const file = normalize(join(root, decodeURIComponent((req.url ?? '/').split('?')[0])))
    try {
      if (!file.startsWith(root + sep)) throw new Error('outside the folder')
      const body = readFileSync(file)
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise(done => server.listen(0, '127.0.0.1', () => done(server)))
}

test('пример и kit работают, скопированные в пустую папку', async ({ page }) => {
  // The copy is left in the temp folder after the run.
  const copy = mkdtempSync(join(tmpdir(), 'banui-copy-'))
  cpSync('skills/banui/kit', join(copy, 'kit'), { recursive: true })
  cpSync('skills/banui/examples/screen-settings', join(copy, 'examples', 'screen-settings'), { recursive: true })
  const server = await serve(copy)
  try {
    const { port } = server.address() as AddressInfo
    const bad: string[] = []
    page.on('pageerror', e => bad.push(String(e))); page.on('requestfailed', r => bad.push(r.url()))
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`) })
    await page.goto(`http://127.0.0.1:${port}/examples/screen-settings/index.html`)
    await page.getByRole('tab', { name: 'Звук' }).click()
    await expect(page.getByRole('switch', { name: 'Звук уведомлений' })).toBeVisible()
    const sw = page.getByRole('switch', { name: 'Звук при записи' }); await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(bad).toEqual([])
  } finally {
    await new Promise(done => server.close(done))
  }
})
