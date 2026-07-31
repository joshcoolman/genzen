import { describe, expect, it } from 'vitest'
import { findRawColors } from './no-raw-color.js'

// #229 collapsed 153 token properties to 18 colors. This is what stops it
// growing back: a rule that cannot be shown to catch the regression is not a
// rule. Paths are the second argument because the allowlist is path-based.

const F = 'src/components/thing/thing.module.css'

describe('catches a raw color', () => {
  it('hex', () => {
    expect(findRawColors('.a { color: #2563eb; }', F)).toHaveLength(1)
  })
  it('rgba', () => {
    expect(findRawColors('.a { background: rgba(0,0,0,.5); }', F)).toHaveLength(
      1,
    )
  })
  it('hsl', () => {
    expect(findRawColors('.a { color: hsl(0 0% 5%); }', F)).toHaveLength(1)
  })
  it('reports the line', () => {
    const [f] = findRawColors('.a {\n  color: #fff;\n}', F)
    expect(f.line).toBe(2)
  })
})

describe('leaves alone what it should', () => {
  it('a token reference', () => {
    expect(findRawColors('.a { color: var(--text); }', F)).toHaveLength(0)
  })
  it('a color-mix over a token', () => {
    expect(
      findRawColors(
        '.a { color: color-mix(in oklab, var(--text) 60%, transparent); }',
        F,
      ),
    ).toHaveLength(0)
  })
  it('a color named inside a comment', () => {
    expect(
      findRawColors(
        '/* was #2563eb before #229 */\n.a { color: var(--accent); }',
        F,
      ),
    ).toHaveLength(0)
  })
  it('tokens.css itself', () => {
    expect(
      findRawColors('.a { color: #fff; }', 'src/styles/tokens.css'),
    ).toHaveLength(0)
  })
  it('the canvas subtree, which is #229 step 3', () => {
    expect(
      findRawColors(
        '.a { color: #2563eb; }',
        'app/(authenticated)/canvas/_components/image-card/image-card.module.css',
      ),
    ).toHaveLength(0)
  })
})

describe('the exemption marker', () => {
  it('takes a reason and covers the file', () => {
    expect(
      findRawColors(
        '/* raw-color-exempt: syntax palette */\n.a { color: #ff0; }',
        F,
      ),
    ).toHaveLength(0)
  })
  it('is ignored without a reason', () => {
    expect(
      findRawColors('/* raw-color-exempt: */\n.a { color: #ff0; }', F),
    ).toHaveLength(1)
  })
})
