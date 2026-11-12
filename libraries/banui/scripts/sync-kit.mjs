// Makes skills/banui/kit/ match dist/, so the skill ships the built library.
//   node scripts/sync-kit.mjs   copies every file of dist/ into skills/banui/kit/
// It only copies. A file left in kit/ that dist/ no longer has is reported, and the run fails
// until a person removes it.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const kit = resolve(root, 'skills/banui/kit')

/** Paths of every file under dir, relative to it. */
function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, resolve(entry.parentPath, entry.name)))
    .sort()
}

const built = files(dist)
if (!built.length) throw new Error('dist/ is empty: run the build first')

for (const file of built) {
  mkdirSync(dirname(resolve(kit, file)), { recursive: true })
  copyFileSync(resolve(dist, file), resolve(kit, file))
}

const stale = files(kit).filter(file => !built.includes(file))
if (stale.length) {
  console.error('skills/banui/kit/ holds files that dist/ no longer has. Remove them and build again:')
  for (const file of stale) console.error(`  ${relative(root, resolve(kit, file))}`)
  process.exit(1)
}
