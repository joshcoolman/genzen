// The suffix has to be readable at the import line (#241).
//
// `.server.ts` used to mean two opposite things: modules a client component
// must never import (`db.server.ts`), and `'use server'` action modules a
// client component imports on purpose. Fourteen of the latter were named the
// same as the former, so the only way to know which rule applied was to open
// the file -- which is the one job the convention exists to do.
//
// The rule now: `.server.ts` is never importable from the client, `.action.ts`
// is. That is checkable from the `'use server'` directive alone, so it is
// checked rather than remembered -- the lesson #219 and #229 both landed on.

/** Is `'use server'` the module's first statement? Only the directive prologue
 *  counts: the string has to lead the file, so a mention in a comment or an
 *  ordinary expression halfway down is not a directive and must not read as one. */
export function hasUseServerDirective(source) {
  for (const statement of source.body) {
    if (
      statement.type !== 'ExpressionStatement' ||
      statement.expression.type !== 'Literal' ||
      typeof statement.expression.value !== 'string'
    ) {
      return false
    }
    if (statement.expression.value === 'use server') return true
  }
  return false
}

/** The verdict for one file, or null when the file is not covered.
 *
 *  Test files are exempt, and not as an oversight: a test for an action module
 *  imports it rather than declaring `'use server'` itself, so judging the test
 *  by its own directive would demand a directive that must not be there. The
 *  test's name should mirror its subject, but that is not a claim this rule can
 *  check from the file alone. */
export function checkSuffix(filename, hasDirective) {
  const name = filename.replace(/\\/g, '/').split('/').pop() ?? ''
  if (/\.test\.ts$/.test(name)) return null

  const isServer = /\.server\.ts$/.test(name)
  const isAction = /\.action\.ts$/.test(name)

  if (isServer && hasDirective) return 'serverWithDirective'
  if (isAction && !hasDirective) return 'actionWithoutDirective'
  return null
}

const MESSAGES = {
  serverWithDirective:
    "`.server.ts` means a module the client can never import, but this declares 'use server'. Rename it to `.action.ts` (#241).",
  actionWithoutDirective:
    "`.action.ts` means a 'use server' module the client imports on purpose, but this has no directive. Rename it to `.server.ts` (#241).",
}

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'the .server.ts / .action.ts suffix must match the `use server` directive',
    },
    schema: [],
    messages: MESSAGES,
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename ?? context.getFilename()
        const verdict = checkSuffix(filename, hasUseServerDirective(node))
        if (verdict) context.report({ node, messageId: verdict })
      },
    }
  },
}

export default { rules: { 'server-suffix': rule } }
