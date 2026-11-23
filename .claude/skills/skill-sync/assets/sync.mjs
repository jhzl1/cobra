#!/usr/bin/env node

/**
 * Rebuilds the auto-invoke table in CLAUDE.md from every skill's frontmatter.
 *
 * Node rather than shell because the input is YAML: matching nesting with awk
 * needs quoting gymnastics that break the first time a phrase contains an
 * apostrophe, and every phrase here is prose.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SKILLS_DIR = join(REPO_ROOT, '.claude/skills')
const CLAUDE_MD = join(REPO_ROOT, 'CLAUDE.md')

const BEGIN = '<!-- BEGIN AUTO-INVOKE -->'
const END = '<!-- END AUTO-INVOKE -->'

const unquote = (value) => value.replace(/^['"]|['"]$/g, '').trim()

/**
 * Reads `metadata.auto_invoke` without a YAML dependency. Indentation is what
 * marks the boundaries: the list ends at the first line that is not a deeper
 * bullet, which is also how YAML itself reads it.
 */
function readActions(skillFile) {
  const lines = readFileSync(skillFile, 'utf8').split('\n')
  if (lines[0].trim() !== '---') return []

  const end = lines.indexOf('---', 1)
  const frontmatter = lines.slice(1, end === -1 ? lines.length : end)

  const actions = []
  let insideList = false

  for (const line of frontmatter) {
    if (/^\s+auto_invoke:\s*$/.test(line)) {
      insideList = true
      continue
    }

    if (!insideList) continue

    const bullet = line.match(/^\s+-\s+(.*)$/)
    if (bullet) {
      actions.push(unquote(bullet[1]))
      continue
    }

    if (line.trim() !== '') insideList = false
  }

  return actions
}

function buildTable() {
  const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const rows = []

  for (const skill of skills) {
    const path = `.claude/skills/${skill}/SKILL.md`

    for (const action of readActions(join(SKILLS_DIR, skill, 'SKILL.md'))) {
      rows.push({ action, path })
    }
  }

  if (rows.length === 0) return '_No skill declares `metadata.auto_invoke` yet._'

  // Column widths are left unpadded: Prettier owns table alignment, and two
  // tools formatting the same block means `--check` fails right after a
  // `format:fix`. The output is run through Prettier below instead.
  const rowsOut = rows.map((row) => `| ${row.action} | \`${row.path}\` |`)

  return ['| Action | Skill |', '| --- | --- |', ...rowsOut].join('\n')
}

const current = readFileSync(CLAUDE_MD, 'utf8')
const begin = current.indexOf(BEGIN)
const end = current.indexOf(END)

if (begin === -1 || end === -1) {
  console.error(`Missing ${BEGIN} / ${END} markers in CLAUDE.md`)
  process.exit(1)
}

const replaced =
  current.slice(0, begin + BEGIN.length) + '\n\n' + buildTable() + '\n\n' + current.slice(end)

const updated = await format(replaced, {
  ...(await resolveConfig(CLAUDE_MD)),
  filepath: CLAUDE_MD,
})

if (process.argv.includes('--check')) {
  if (updated !== current) {
    console.error('CLAUDE.md is out of date. Run: pnpm skills:sync')
    process.exit(1)
  }

  console.log('CLAUDE.md is up to date.')
  process.exit(0)
}

writeFileSync(CLAUDE_MD, updated)
console.log(`CLAUDE.md updated from ${SKILLS_DIR}`)
