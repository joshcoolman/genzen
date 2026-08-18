// Fails on `var(--x)` where `--x` is declared nowhere (#407).
//
// **This is silent breakage, not a style violation.** An undeclared custom
// property is not an error and not a warning -- the declaration is simply
// dropped and the element inherits. `--text-faint` was asked for in three
// modules and declared in none, so three surfaces quietly took their parent's
// colour instead of the muted step they wanted. In the same two files
// `--dur-fast` and `--ease` were undeclared as well (the real names are
// `--duration-fast` and `--ease-in-out`), which meant those transitions ran
// with no duration and no easing. Nobody noticed any of it.
//
// A separate script rather than an ESLint rule, for the same reason as
// `check-raw-colors.mjs`: ESLint does not parse `.module.css`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const GLOBALS = ['src/styles/tokens.css', 'src/styles/base.css']

/**
 * Custom properties set from JavaScript, not from a stylesheet.
 *
 * These are a component's own API -- `ImageBox` writes `--image-box-size` from
 * its `size` prop -- so they are declared in a `style={{...}}` object and will
 * never appear in a `.css` file. Listing them is the price of catching the
 * genuine article; the list is short, and adding to it is a deliberate act
 * rather than something that happens by typo.
 */
const SET_IN_JS = new Set([
  '--available-height',
  '--badge-border',
  '--badge-color',
  '--dialog-title-color',
  '--image-box-pad',
  '--image-box-size',
  '--media-box-pad',
  '--media-box-size',
  '--panel-rhythm',
  '--run-columns',
  '--sheet-background',
  '--sheet-gap',
  '--sheet-max-width',
  '--sheet-padding',
  '--sheet-width',
  '--skeleton-bg',
  '--skeleton-radius',
  '--textarea-font-size',
])

const DECLARED = /^\s*(--[\w-]+)\s*:/gm
const USED = /var\(\s*(--[\w-]+)/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.css')) out.push(full)
  }
  return out
}

const global = new Set(
  GLOBALS.flatMap((f) => [
    ...readFileSync(join(ROOT, f), 'utf8').matchAll(DECLARED),
  ]).map((m) => m[1]),
)

const findings = []
for (const file of ['app', 'src'].flatMap((r) => walk(join(ROOT, r)))) {
  const text = readFileSync(file, 'utf8')
  // A module may declare its own property and use it two rules later. That is
  // local scope working as intended, not a missing token.
  const local = new Set([...text.matchAll(DECLARED)].map((m) => m[1]))
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(USED)) {
      const name = m[1]
      if (global.has(name) || local.has(name) || SET_IN_JS.has(name)) continue
      findings.push({ file: relative(ROOT, file), line: i + 1, name })
    }
  })
}

if (findings.length === 0) {
  console.log('no undeclared custom properties')
  process.exit(0)
}

for (const f of findings) {
  console.error(`${f.file}:${f.line}  undeclared \`${f.name}\``)
}
console.error(
  `\n${findings.length} undeclared custom propert(ies). An undeclared property` +
    ' does not error -- the declaration is dropped and the element inherits, so' +
    ' this fails silently in the browser (#407).' +
    '\nUse a token from src/styles/tokens.css, declare it in the same module, or' +
    ' add it to SET_IN_JS if a component writes it from a prop.',
)
process.exit(1)
