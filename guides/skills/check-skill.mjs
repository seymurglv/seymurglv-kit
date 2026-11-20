// Checks skill folders against the rules marked "checked" in guides/skills/README.md.
//   node guides/skills/check-skill.mjs <skill-folder>...   checks those folders
//   node guides/skills/check-skill.mjs                     checks every SKILL.md kept in this repository
// Prints one line per finding and exits 1 when there is any.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PORTABLE = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']

/** Top-level keys of the frontmatter with their text, and the body's first line number. */
function frontmatter(text) {
  const lines = text.split('\n')
  const end = lines.indexOf('---', 1)
  if (lines[0] !== '---' || end < 0) return null
  const fields = {}
  let key = null
  for (const line of lines.slice(1, end)) {
    const top = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (top) { key = top[1]; fields[key] = /^[>|][+-]?$/.test(top[2]) ? '' : top[2] }
    else if (key && line.trim()) fields[key] = `${fields[key]} ${line.trim()}`.trim()
  }
  for (const k of Object.keys(fields)) fields[k] = fields[k].replace(/^(["'])(.*)\1$/, '$2')
  return { fields, bodyLines: lines.length - end - 1 }
}

/** Relative link targets of a markdown text, without anchors. Code blocks are skipped. */
function links(text) {
  const prose = text.replace(/```[\s\S]*?```/g, '')
  return [...prose.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(m => m[1].split('#')[0])
    .filter(target => target && !/^[a-z]+:/i.test(target))
}

function check(folder) {
  const found = []
  const say = (file, message) => found.push(`${relative(repo, join(folder, file))}  ${message}`)
  const skillFile = join(folder, 'SKILL.md')
  if (!existsSync(skillFile)) return [`${relative(repo, folder)}  no SKILL.md`]

  const text = readFileSync(skillFile, 'utf8')
  const front = frontmatter(text)
  if (!front) return [`${relative(repo, skillFile)}  no frontmatter between two --- lines`]
  const { name = '', description = '' } = front.fields

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) say('SKILL.md', `name "${name}" is not lowercase letters, digits and single hyphens, up to 64`)
  if (name !== basename(folder)) say('SKILL.md', `name "${name}" differs from the folder "${basename(folder)}"`)
  if (!description || description.length > 1024) say('SKILL.md', `description is ${description.length} characters, wanted 1 to 1024`)
  if (/[<>]/.test(description)) say('SKILL.md', 'description has an angle bracket')
  for (const key of Object.keys(front.fields)) if (!PORTABLE.includes(key)) say('SKILL.md', `frontmatter field "${key}" is not portable`)
  if (front.bodyLines >= 500) say('SKILL.md', `body is ${front.bodyLines} lines, wanted under 500`)

  const linked = links(text)
  for (const target of linked) if (!existsSync(join(folder, target))) say('SKILL.md', `link to "${target}" leads nowhere`)

  const refs = join(folder, 'references')
  for (const file of existsSync(refs) ? readdirSync(refs).filter(f => f.endsWith('.md')) : []) {
    const path = `references/${file}`
    const body = readFileSync(join(refs, file), 'utf8')
    if (!linked.some(target => target.replace(/^\.\//, '') === path)) say(path, 'is not linked from SKILL.md')
    if (body.split('\n').length > 100 && !/^## Contents$/m.test(body)) say(path, 'is over 100 lines and has no "## Contents" list')
    for (const target of links(body)) {
      if (!existsSync(join(refs, target))) say(path, `link to "${target}" leads nowhere`)
      else if (target.endsWith('.md') && dirname(resolve(refs, target)) === refs) say(path, `links to another reference, "${target}"`)
    }
  }

  const evals = join(folder, 'evals/evals.json')
  if (!existsSync(evals)) say('evals/evals.json', 'is missing')
  else if (!(JSON.parse(readFileSync(evals, 'utf8')).evals?.length >= 3)) say('evals/evals.json', 'has fewer than three tasks')
  return found
}

const asked = process.argv.slice(2)
const folders = asked.length
  ? asked.map(path => resolve(path))
  : execFileSync('git', ['ls-files', '-co', '--exclude-standard', '--', '*/SKILL.md'], { cwd: repo, encoding: 'utf8' })
    .split('\n').filter(Boolean).map(path => dirname(join(repo, path)))

const findings = folders.flatMap(check)
for (const line of findings) console.error(line)
if (!findings.length) console.log(`${folders.length} skill${folders.length === 1 ? '' : 's'} checked, nothing found`)
process.exit(findings.length ? 1 : 0)
