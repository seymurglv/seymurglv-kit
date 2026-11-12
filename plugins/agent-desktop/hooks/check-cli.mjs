#!/usr/bin/env node
// SessionStart: compare the installed agent-desktop CLI with the release the skills are
// pinned to (upstream.json). Silent when they match; otherwise one line of context that
// says how to install or update. No network: the plugin's own updates bring new pins.

import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pin = JSON.parse(await readFile(join(root, 'upstream.json'), 'utf8'))

const cmp = (a, b) => {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0)
  return 0
}

// exec, not execFile: on Windows the npm launcher is a .cmd shim that needs a shell
exec('agent-desktop version', { timeout: 5000 }, (err, stdout) => {
  let installed
  try {
    installed = JSON.parse(stdout).data.version
  } catch {}
  if (err || !installed) {
    console.log(`agent-desktop plugin: the CLI is not installed. The skills need it: npm install -g agent-desktop@${pin.version}`)
  } else if (cmp(installed, pin.version) < 0) {
    console.log(`agent-desktop plugin: the CLI is ${installed}, the skills are for ${pin.version}. Update before using them: npm install -g agent-desktop@latest`)
  }
})
