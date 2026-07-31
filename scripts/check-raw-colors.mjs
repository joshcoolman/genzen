// Fails on a raw color written outside src/styles/tokens.css (#229).
//
// A separate script rather than an ESLint rule because ESLint does not parse
// `.module.css`. Wired into `pnpm check` and CI, so it fails on the commit that
// introduces one rather than at the next audit.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { findRawColors } from '../eslint-rules/no-raw-color.js'

const ROOT = new URL('..', import.meta.url).pathname
const ROOTS = ['app', 'src']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.css')) out.push(full)
  }
  return out
}

const findings = ROOTS.flatMap((r) => walk(join(ROOT, r))).flatMap((file) => {
  const rel = relative(ROOT, file)
  return findRawColors(readFileSync(file, 'utf8'), rel)
})

if (findings.length === 0) {
  console.log('no raw colors outside tokens.css')
  process.exit(0)
}

for (const f of findings) {
  console.error(`${f.file}:${f.line}  raw color \`${f.value}\``)
}
console.error(
  `\n${findings.length} raw color(s). Colors live in src/styles/tokens.css and` +
    ' nowhere else, or a reskin stops being one edit (#229).' +
    '\nUse a token, or put a comment on the line saying why this one cannot.',
)
process.exit(1)
