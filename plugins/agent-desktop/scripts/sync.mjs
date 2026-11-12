#!/usr/bin/env node
// Pull the agent-desktop skills from Vercel Labs' latest release into this plugin.
//
//   node plugins/agent-desktop/scripts/sync.mjs            the latest release
//   node plugins/agent-desktop/scripts/sync.mjs v1.0.2     one release
//
// The skills are pinned to a release tag, not to main, so they match the CLI that
// `npm install -g agent-desktop` installs. Each skill folder is replaced whole, LICENSE
// is refreshed, and upstream.json records the tag and commit (the NOTICE and the
// session hook read it). Prints "unchanged" or "updated <old> -> <new>".
// GITHUB_TOKEN, when set, lifts the API's rate limit.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'vercel-labs/agent-desktop'
const SKILLS = ['agent-desktop', 'agent-desktop-windows', 'agent-desktop-macos', 'agent-desktop-linux']
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'seymurglv-sync' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers })
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function raw(sha, path) {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${path}`, { headers: { 'User-Agent': headers['User-Agent'] } })
  if (!res.ok) throw new Error(`raw ${path}: ${res.status}`)
  return res.text()
}

const tag = process.argv[2] ?? (await api('releases/latest')).tag_name
const commit = (await api(`commits/${tag}`)).sha

const pinPath = join(root, 'upstream.json')
const before = JSON.parse(await readFile(pinPath, 'utf8').catch(() => '{}'))
if (before.commit === commit) {
  console.log(`unchanged ${tag} (${commit.slice(0, 7)})`)
  process.exit(0)
}

const tree = (await api(`git/trees/${commit}?recursive=1`)).tree
for (const skill of SKILLS) {
  const files = tree.filter((t) => t.type === 'blob' && t.path.startsWith(`skills/${skill}/`))
  if (!files.length) throw new Error(`${tag} has no skills/${skill}/`)
  await rm(join(root, 'skills', skill), { recursive: true, force: true })
  for (const f of files) {
    const dest = join(root, f.path)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, await raw(commit, f.path))
  }
}
await writeFile(join(root, 'LICENSE'), await raw(commit, 'LICENSE'))

const version = tag.replace(/^v/, '')
await writeFile(pinPath, JSON.stringify({ repo: REPO, tag, version, commit, skills: SKILLS }, null, 2) + '\n')
console.log(`updated ${before.tag ?? 'none'} -> ${tag} (${commit.slice(0, 7)})`)
