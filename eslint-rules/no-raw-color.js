// Never a raw color outside `src/styles/tokens.css` (#229).
//
// The token file claims a reskin is a channel edit in one file. That claim was
// false: 64 raw colors sat above it, and the palette had drifted into 153
// properties where ten names resolved to four values. Collapsing it is only
// worth doing once -- this is what stops it happening again.
//
// A lint rule rather than a line in a doc, for the reason #219 established:
// a rule enforced by remembering is a rule that decays silently.

const COLOR =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(|\boklch\s*\(|\bcolor-mix\s*\(/

/** Where a raw color is still allowed, and why.
 *
 *  The canvas subtree used to be here -- 60 of the repo's 64 raw colors, held
 *  back for its own visual pass. That pass is #229 step 3 and it has landed, so
 *  the list is down to the one entry that is not debt. It can only shrink. */
const ALLOWED = [
  // The token file is the one place a color is written.
  'src/styles/tokens.css',
]

/** An explicit, greppable opt-out: `/* raw-color-exempt: <why> *\/`.
 *
 *  It exempts the rest of the file, deliberately. A per-line marker would sit
 *  above four sibling declarations of one syntax palette and say the same thing
 *  four times; a file that declares itself an exception is one visible unit, and
 *  `grep raw-color-exempt` is the whole list. A reason is required -- the
 *  exemptions are the documentation of where this is knowingly bent (#219). */
const EXEMPT = /raw-color-exempt:\s*([^\s*/][^\n*]*)/

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'no raw color values in CSS modules -- use a token from src/styles/tokens.css',
    },
    schema: [],
    messages: {
      raw: 'Raw color `{{value}}`. Colors live in `src/styles/tokens.css` and nowhere else, or a reskin stops being one edit (#229). Use a token, or annotate the line with a comment saying why this one cannot.',
    },
  },
  create() {
    return {}
  },
}

/**
 * The CSS check itself, exported plainly because ESLint does not parse
 * `.module.css`. `scripts/check-raw-colors.mjs` runs it; the unit test calls it
 * directly. Returns one finding per offending line.
 */
export function findRawColors(source, filePath) {
  if (ALLOWED.some((a) => filePath.includes(a))) return []

  const exempt = EXEMPT.exec(source)
  if (exempt && exempt[1].trim()) return []

  const findings = []
  const lines = source.split('\n')
  let inComment = false

  lines.forEach((line, i) => {
    // Track block comments so a color inside prose is not a finding.
    const stripped = stripComments(line, inComment)
    inComment = stripped.inComment
    const code = stripped.code

    const m = COLOR.exec(code)
    if (!m) return
    // `color-mix(... var(--token) ...)` is token-derived and fine.
    if (m[0].startsWith('color-mix') && /var\(--/.test(code)) return
    findings.push({ line: i + 1, value: m[0].trim(), file: filePath })
  })

  return findings
}

function stripComments(line, inComment) {
  let code = ''
  let i = 0
  while (i < line.length) {
    if (inComment) {
      const end = line.indexOf('*/', i)
      if (end === -1) return { code, inComment: true }
      i = end + 2
      inComment = false
      continue
    }
    const start = line.indexOf('/*', i)
    if (start === -1) {
      code += line.slice(i)
      return { code, inComment: false }
    }
    code += line.slice(i, start)
    i = start + 2
    inComment = true
  }
  return { code, inComment }
}

export { ALLOWED }
export default { rules: { 'no-raw-color': rule } }
