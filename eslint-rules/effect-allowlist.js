// Effect is a topic inside News, and nowhere else yet (#721).
//
// The rewrite is a proof of concept: News is the smallest surface with every
// ingredient -- typed failure per step, a fallback on one step, a fan-out --
// and the patterns it settles are meant to be copied outward on purpose, one
// surface at a time. Without a border that is not what happens. A library this
// pleasant leaks: someone reaches for `Effect.retry` in a video action because
// it is right there, and the app ends up half-converted with two error models,
// which is strictly worse than either one.
//
// So the allowlist is the decision, written down where it binds. Widening it is
// a one-line edit and that is the point -- it should take a moment's thought
// and show up in a diff, rather than happening by import.

const ALLOWED = ['src/lib/effect/', 'app/(authenticated)/news/']

/** Is `source` the Effect package or one of its subpaths? */
export function isEffectImport(source) {
  return source === 'effect' || source.startsWith('effect/')
}

/** May this file import Effect? Paths are compared as posix suffixes so the
 *  rule behaves the same from any checkout directory. */
export function isAllowedFile(filename) {
  const path = String(filename).replace(/\\/g, '/')
  return ALLOWED.some((dir) => path.includes(`/${dir}`) || path.startsWith(dir))
}

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Effect may only be imported from the modules that own it',
    },
    schema: [],
    messages: {
      outsideAllowlist:
        '`{{source}}` may only be imported from src/lib/effect/ or app/(authenticated)/news/ (#721). Widen the list in eslint-rules/effect-allowlist.js if the border is meant to move.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    if (isAllowedFile(filename)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source === 'string' && isEffectImport(source)) {
          context.report({
            node,
            messageId: 'outsideAllowlist',
            data: { source },
          })
        }
      },
    }
  },
}

export default { rules: { 'effect-allowlist': rule } }
