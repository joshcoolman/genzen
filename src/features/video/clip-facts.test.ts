import { describe, expect, it } from 'vitest'
import {
  aspectLabel,
  clipModel,
  clipName,
  namedRatio,
  sameAspect,
} from './clip-facts'

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

describe('namedRatio', () => {
  // The two shapes the lineup actually returns for one 21:9 request. They are
  // the same shape everywhere else in the app, so they have to lay out the
  // same too -- sized from the raw ratio they differed by ~14px of card.
  it('snaps every clip that reads 21:9 to the same number', () => {
    expect(namedRatio(1504 / 672)).toBe(namedRatio(1568 / 672))
    expect(namedRatio(1504 / 672)).toBe(21 / 9)
  })

  it('leaves a ratio no name covers alone', () => {
    expect(namedRatio(3.5)).toBe(3.5)
  })

  it('has nothing to say about an unknown shape', () => {
    expect(namedRatio(null)).toBeNull()
  })
})

/**
 * A clip's name and the model that made it share one column, and which is
 * which is decided here rather than stored (#657). The case that matters is
 * the old row: every clip made before naming existed has the model label in
 * `title` and must not read as though someone typed it.
 */
describe('clipModel / clipName', () => {
  const clip = (title: string, label?: string) => ({
    title,
    generation_metadata: label ? { model_label: label } : null,
    width: 1280,
    height: 720,
  })

  it('reads the model off the metadata copy, not off the title', () => {
    expect(clipModel(clip('Scene two', 'Kling 2.5 Pro'))).toBe('Kling 2.5 Pro')
    expect(clipName(clip('Scene two', 'Kling 2.5 Pro'))).toBe('Scene two')
  })

  it('has no name while the title is still the label', () => {
    expect(clipName(clip('Kling 2.5 Pro', 'Kling 2.5 Pro'))).toBeNull()
  })

  it('falls back to the title on a row written before naming existed', () => {
    expect(clipModel(clip('Kling 2.5 Pro'))).toBe('Kling 2.5 Pro')
    expect(clipName(clip('Kling 2.5 Pro'))).toBeNull()
  })
})
