import { describe, expect, it } from 'vitest'
import { isAllowedFile, isEffectImport } from './effect-allowlist.js'

// The border only holds if it is checked. These are the two ways it would slip:
// a second surface importing Effect because it is convenient, and a subpath
// import sliding past a rule that only matched the bare package name.

describe('what counts as an Effect import', () => {
  it('matches the package', () => {
    expect(isEffectImport('effect')).toBe(true)
  })

  it('matches a subpath -- effect/unstable/sql is still Effect', () => {
    expect(isEffectImport('effect/unstable/ai')).toBe(true)
  })

  it('does not match a package that merely starts with the word', () => {
    expect(isEffectImport('effector')).toBe(false)
    expect(isEffectImport('#/lib/effect/result')).toBe(false)
  })
})

describe('who may import it', () => {
  it('allows the modules that own it', () => {
    expect(isAllowedFile('/repo/src/lib/effect/errors.ts')).toBe(true)
  })

  it('allows the News route', () => {
    expect(
      isAllowedFile('/repo/app/(authenticated)/news/_actions/news.ts'),
    ).toBe(true)
  })

  it('refuses a feature -- the case the rule exists for', () => {
    expect(isAllowedFile('/repo/src/features/ai-images/retry.ts')).toBe(false)
  })

  it('refuses another route', () => {
    expect(
      isAllowedFile('/repo/app/(authenticated)/video/_actions/go.ts'),
    ).toBe(false)
  })

  it('is not fooled by a similarly named folder', () => {
    expect(isAllowedFile('/repo/src/lib/effects/index.ts')).toBe(false)
  })
})
