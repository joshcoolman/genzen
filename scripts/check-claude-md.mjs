#!/usr/bin/env node
// Warn when a commit changes the *shape* of a folder that has a CLAUDE.md,
// without touching that CLAUDE.md.
//
// Why added/deleted/renamed only, and not modified: a CLAUDE.md states what a
// folder owns, its dependency direction, and its invariants. Those go stale when
// files appear, move, or vanish -- not when a function body changes. Measured
// over 40 commits of this repo: "modified something governed by a CLAUDE.md"
// fires on 100% of commits (wallpaper, ignored within a day), while structural
// change fires on 50%, and only 8 of those 20 updated the doc. This targets the
// other 12.
//
// Advisory by design: it prints and exits 0. `--strict` exits 1 instead, for
// CI or for anyone who wants it to bite. The judgement it asks for -- did the
// boundary actually change? -- is not one a script can make, so it never
// pretends to and never blocks the commit.
//
// Usage: node scripts/check-claude-md.mjs [--strict] [--against <ref>]

import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'

const argv = process.argv.slice(2)
const STRICT = argv.includes('--strict')
const againstFlag = argv.indexOf('--against')
const AGAINST = againstFlag !== -1 ? argv[againstFlag + 1] : null

function git(args) {
  const { stdout, status } = spawnSync('git', args, { encoding: 'utf8' })
  return status === 0 ? stdout : ''
}

/** Folders that own a CLAUDE.md. '' is the repo root. */
const owners = git(['ls-files', 'CLAUDE.md', '*/CLAUDE.md'])
  .split('\n')
  .filter(Boolean)
  .map((p) => (dirname(p) === '.' ? '' : dirname(p)))

/**
 * The nearest CLAUDE.md above a path, root excluded. Root governs everything, so
 * including it would fire on every commit -- it earns a mention only for the one
 * thing it actually catalogs, handled separately below.
 */
function nearestOwner(path) {
  const candidates = owners.filter(
    (o) => o !== '' && (path === o || path.startsWith(`${o}/`)),
  )
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null
}

/**
 * The root CLAUDE.md carries the feature/surface catalog, so it goes stale when a
 * feature or route folder is *itself* added or removed -- not when a file inside
 * one changes. That is a question about the set of folders, so compare the sets
 * rather than trying to read it off a single path.
 */
const CATALOG_PARENTS = ['src/features', 'app/(authenticated)']

function childDirsBefore(parent) {
  return new Set(
    git(['ls-tree', '--name-only', '-d', 'HEAD', `${parent}/`])
      .split('\n')
      .filter(Boolean),
  )
}
function childDirsAfter(parent) {
  const dirs = git(['ls-files', '--', `${parent}/`])
    .split('\n')
    .filter(Boolean)
    .map((p) => p.slice(parent.length + 1))
    // Only a path with a further separator names a child *directory*; a bare
    // `layout.tsx` sitting in the parent is a file, and counting it as a folder
    // invents a catalog change on every commit that touches one.
    .filter((rest) => rest.includes('/'))
    .map((rest) => `${parent}/${rest.split('/')[0]}`)
  return new Set(dirs)
}

/** Feature/surface folders that appeared or disappeared in this commit. */
function catalogFolderChanges() {
  const moved = []
  for (const parent of CATALOG_PARENTS) {
    const before = childDirsBefore(parent)
    const after = childDirsAfter(parent)
    for (const dir of after) if (!before.has(dir)) moved.push(`added ${dir}/`)
    for (const dir of before) if (!after.has(dir)) moved.push(`removed ${dir}/`)
  }
  return moved
}

const diffArgs = AGAINST
  ? ['diff', '--name-status', '--diff-filter=ADR', AGAINST]
  : ['diff', '--cached', '--name-status', '--diff-filter=ADR']

const changed = git(diffArgs)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const parts = line.split('\t')
    return { status: parts[0][0], path: parts[parts.length - 1] }
  })
  .filter((c) => !c.path.endsWith('CLAUDE.md'))

/** Docs already part of this commit are, by definition, being kept current. */
const stagedDocs = new Set(
  (AGAINST
    ? git(['diff', '--name-only', AGAINST])
    : git(['diff', '--cached', '--name-only'])
  )
    .split('\n')
    .filter((p) => p.endsWith('CLAUDE.md')),
)

/** owner folder -> the structural changes under it */
const pending = new Map()

for (const { status, path } of changed) {
  const owner = nearestOwner(path)
  if (owner && !stagedDocs.has(`${owner}/CLAUDE.md`)) {
    if (!pending.has(owner)) pending.set(owner, [])
    pending.get(owner).push({ status, path })
  }
}

const catalogChanges = changed.length ? catalogFolderChanges() : []
const rootStale =
  catalogChanges.length > 0 &&
  !stagedDocs.has('CLAUDE.md') &&
  owners.includes('')

/**
 * A feature folder is required to carry its own CLAUDE.md -- the root README and
 * `CLAUDE.md` both promise one is there to read before editing. A new folder that
 * arrives without one breaks that promise silently.
 */
const missingDocs = catalogChanges
  .filter((c) => c.startsWith('added src/features/'))
  .map((c) => c.replace(/^added /, '').replace(/\/$/, ''))
  .filter((dir) => !owners.includes(dir) && !stagedDocs.has(`${dir}/CLAUDE.md`))

if (pending.size === 0 && !rootStale && missingDocs.length === 0)
  process.exit(0)

const LABEL = { A: 'added', D: 'deleted', R: 'renamed' }
const lines = [
  '',
  'CLAUDE.md check -- folder shape changed, the doc did not:',
  '',
]

for (const [owner, changes] of [...pending].sort()) {
  lines.push(`  ${owner}/CLAUDE.md`)
  for (const { status, path } of changes.slice(0, 6)) {
    lines.push(`    ${LABEL[status] ?? status} ${path}`)
  }
  if (changes.length > 6) lines.push(`    ...and ${changes.length - 6} more`)
  lines.push('')
}

if (rootStale) {
  lines.push('  CLAUDE.md (root -- the feature/surface catalog)')
  for (const change of catalogChanges.slice(0, 6)) lines.push(`    ${change}`)
  lines.push('')
}

if (missingDocs.length) {
  lines.push('  new feature folder with no CLAUDE.md of its own:')
  for (const dir of missingDocs) lines.push(`    ${dir}/`)
  lines.push('')
}

lines.push(
  'A CLAUDE.md states what a folder owns, its dependency direction, and its',
  'invariants. Check whether any of those moved. If nothing did, commit as-is --',
  'this is a prompt, not a gate.',
  '',
)

process.stderr.write(lines.join('\n'))
process.exit(STRICT ? 1 : 0)
