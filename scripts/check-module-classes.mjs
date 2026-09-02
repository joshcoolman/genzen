// Fails on `styles.foo` where the module beside it has no `.foo` rule (#531).
//
// **This is silent breakage, not a style violation.** `styles.foo` for a class
// the stylesheet does not define is `undefined`, and React renders
// `className={undefined}` as no class at all -- the element falls back to
// browser defaults, or a state class never applies. The build passes, ESLint
// passes, the tests pass, and TypeScript cannot see it because the generated
// module type is a loose index signature. The only detector was someone
// looking at the screen, and it cost two shipped regressions in one session
// (#530): a deleted `.ends`/`.end` pair stacked the frames under the player
// instead of splitting the card, and a deleted `.play` put the play button
// below the poster at the left edge. Both were found from a screenshot.
//
// A separate script rather than an ESLint rule, for the same reason as
// `check-raw-colors.mjs` and `check-undeclared-tokens.mjs`: ESLint does not
// parse `.module.css`. It joins those two in `pnpm check` and CI because all
// three catch the same shape of fault -- a CSS mistake that does not error, it
// just quietly does nothing.
//
// Two details are load-bearing, and getting either wrong is why the first pass
// at this reported eight files instead of five:
//
//   - **Comments are stripped before matching.** A comment mentioning
//     `.tile` otherwise counts as a definition, so a genuinely missing rule
//     reads as present.
//   - **A selector is matched anywhere, not at line start.** A rule inside a
//     media query is indented and one in a group sits on a continuation line;
//     anchoring to `^\.` called `app-chrome`'s `mobileNav`, `lab-nav`'s
//     `navCollapsed` and `linkLabel`, and `expandable-icon-button`'s
//     `pillDestructive` undefined when all four are defined.
//
// Definitions are read from selector preludes only -- the text between the
// previous `}`, `{` or `;` and an opening `{`. That is what keeps a class name
// appearing in a declaration value from counting as a definition, and it is
// why `@media (...)` preludes contribute nothing.
//
// Not checked, deliberately: `styles[variant]` and friends. Six components
// index the module with a prop (`button`, `dialog`, `sheet`, `toast`,
// `action-button`, `expandable-icon-button`), and the key is only known at
// runtime. Reporting them would mean either false failures or a suppression
// list longer than the finding.
//
// The reverse question -- a rule no component references -- is deliberately
// out of scope. Dead CSS is a different problem from a broken element: it
// costs bytes, not a rendering bug, and it wants a warning rather than a
// failure. Filed separately if it is ever wanted.
//
// Usage: node scripts/check-module-classes.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

const IMPORT = /^import\s+([A-Za-z_$][\w$]*)\s+from\s+'([^']*\.module\.css)'/gm
const COMMENTS = /\/\*[\s\S]*?\*\//g
const CLASS_IN_SELECTOR = /\.(-?[A-Za-z_][\w-]*)/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.tsx')) out.push(full)
  }
  return out
}

/**
 * The class names a stylesheet defines.
 *
 * Every selector prelude is the run of text ending at an opening brace and
 * starting after the previous `{`, `}` or `;`. Reading only those keeps a
 * class name that appears in a declaration -- a `composes:` target, a
 * `content` string -- from counting as a definition of its own.
 */
function definedClasses(css) {
  const text = css.replace(COMMENTS, '')
  const names = new Set()
  let preludeStart = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      const prelude = text.slice(preludeStart, i)
      for (const m of prelude.matchAll(CLASS_IN_SELECTOR)) names.add(m[1])
      preludeStart = i + 1
    } else if (ch === '}' || ch === ';') {
      preludeStart = i + 1
    }
  }
  return names
}

/** Every `styles.foo` and `styles['foo']` in a component, with its line. */
function usedClasses(tsx, ident) {
  const dot = new RegExp(`\\b${ident}\\.([A-Za-z_$][\\w$]*)`, 'g')
  const bracket = new RegExp(`\\b${ident}\\[\\s*['"]([^'"]+)['"]\\s*\\]`, 'g')
  const uses = []
  tsx.split('\n').forEach((line, i) => {
    for (const re of [dot, bracket]) {
      re.lastIndex = 0
      for (const m of line.matchAll(re)) uses.push({ name: m[1], line: i + 1 })
    }
  })
  return uses
}

const findings = []
for (const file of ['app', 'src'].flatMap((r) => walk(join(ROOT, r)))) {
  const tsx = readFileSync(file, 'utf8')
  for (const m of tsx.matchAll(IMPORT)) {
    const [, ident, spec] = m
    const cssPath = resolve(dirname(file), spec)
    if (!existsSync(cssPath)) continue
    const defined = definedClasses(readFileSync(cssPath, 'utf8'))
    for (const use of usedClasses(tsx, ident)) {
      if (defined.has(use.name)) continue
      findings.push({
        file: relative(ROOT, file),
        css: relative(ROOT, cssPath),
        ...use,
      })
    }
  }
}

if (findings.length === 0) {
  console.log('no undefined CSS module classes')
  process.exit(0)
}

for (const f of findings) {
  console.error(`${f.file}:${f.line}  \`${f.name}\` is not defined in ${f.css}`)
}
console.error(
  `\n${findings.length} reference(s) to a class the stylesheet does not define.` +
    ' `styles.x` is `undefined` there, and React renders `className={undefined}`' +
    ' as no class at all -- so this fails silently in the browser (#531).' +
    '\nEither write the missing rule or delete the dead reference.',
)
process.exit(1)
