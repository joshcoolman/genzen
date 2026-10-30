// Fails on a raw spacing, type or radius value written in a CSS module (#797).
//
// check:colors and check:tokens catch a raw color and an undeclared variable;
// nothing caught a raw `padding: 12px`, so the spacing, type and radius scales
// in tokens.css were advice. This makes them the rule for the properties where
// a scale exists: padding, margin, gap, font-size, font-weight, border-radius.
// Widths, heights and positions are not scaled and stay free.
//
// `0` is not a value worth a token, and `em` is relative to the element's own
// type, so neither is flagged. A line that genuinely needs a raw value carries
// a comment with `raw:` and the reason, the same escape check:colors offers.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ROOTS = ['app', 'src']
/* readme/ sets prose sizes on purpose; canvas/[id] is going (#720) -- drop
   that entry when it does. */
const ALLOW = [
  'app/(authenticated)/readme/',
  'app/(authenticated)/canvas/[id]/',
]

const PROPERTY =
  /^(padding|margin)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^(row-|column-)?gap$|^font-size$|^font-weight$|^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/
const LENGTH = /(?<![\w-])-?\d*\.?\d+(px|rem)\b/
const WEIGHT = /^\d{3}$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.module.css')) out.push(full)
  }
  return out
}

export function findRawValues(source, file) {
  const found = []
  source.split('\n').forEach((text, i) => {
    if (/raw:/.test(text)) return
    const code = text.replace(/\/\*.*?\*\//g, '')
    for (const m of code.matchAll(/(?:^|[{;\s])([a-z-]+)\s*:\s*([^;{}]+)/g)) {
      if (!PROPERTY.test(m[1])) continue
      const value = m[2].trim()
      const raw =
        m[1] === 'font-weight' ? WEIGHT.test(value) : LENGTH.exec(value)?.[0]
      if (raw) found.push({ file, line: i + 1, value: `${m[1]}: ${value}` })
    }
  })
  return found
}

const findings = ROOTS.flatMap((r) => walk(join(ROOT, r)))
  .map((file) => relative(ROOT, file))
  .filter((rel) => !ALLOW.some((prefix) => rel.startsWith(prefix)))
  .flatMap((rel) => findRawValues(readFileSync(join(ROOT, rel), 'utf8'), rel))

if (findings.length === 0) {
  console.log('no raw spacing, type or radius values in modules')
  process.exit(0)
}

for (const f of findings) console.error(`${f.file}:${f.line}  \`${f.value}\``)
console.error(
  `\n${findings.length} raw value(s). Padding, margin, gap, font size, weight` +
    ' and radius read a token from src/styles/tokens.css (#797).' +
    '\nUse one, or put a `raw:` comment on the line saying why this one cannot.',
)
process.exit(1)
