import { describe, expect, it } from 'vitest'
import { aspectLabel, sameAspect } from './clip-facts'

/**
 * The tolerance is the whole feature: it decides which clips the Sequence
 * picker hides (#512), and getting it wrong is invisible -- the dialog simply
 * shows fewer clips and looks like it is working.
 *
 * The numbers here are real ones out of the library, not invented ones.
 */
describe('sameAspect', () => {
  it('groups what one request for a shape actually comes back as', () => {
    // Both are "16:9" as far as any model in the lineup is concerned.
    expect(sameAspect(1280 / 720, 1280 / 704)).toBe(true)
    // And the three widths 21:9 arrives at.
    expect(sameAspect(1440 / 608, 1568 / 672)).toBe(true)
    expect(sameAspect(1536 / 672, 1568 / 672)).toBe(true)
  })

  it('keeps apart the shapes that cannot cut together', () => {
    expect(sameAspect(1280 / 720, 1536 / 672)).toBe(false)
    expect(sameAspect(720 / 1280, 1280 / 720)).toBe(false)
    // 4:3 against 5:4 -- the closest pair a person would still call different.
    expect(sameAspect(4 / 3, 5 / 4)).toBe(false)
  })

  it('never matches an unknown shape, including another unknown one', () => {
    expect(sameAspect(null, 16 / 9)).toBe(false)
    expect(sameAspect(16 / 9, null)).toBe(false)
    expect(sameAspect(null, null)).toBe(false)
  })
})

describe('aspectLabel', () => {
  it('names the ratios the lineup produces', () => {
    expect(aspectLabel(1280 / 704)).toBe('16:9')
    expect(aspectLabel(720 / 1280)).toBe('9:16')
    expect(aspectLabel(768 / 1152)).toBe('2:3')
    expect(aspectLabel(null)).toBeNull()
  })
})
