import { describe, expect, it } from 'vitest'
import { refUsageNote } from './ref-usage'

describe('refUsageNote', () => {
  it('names both counts when images were dropped', () => {
    expect(refUsageNote({ images_used: 1, images_requested: 5 })).toBe(
      '1 of 5 images',
    )
  })

  it('is silent on a generation that used everything', () => {
    // The counts are only written when they disagree, but a card must not grow
    // a note if that ever changes -- "4 of 4 images" is noise on every card.
    expect(refUsageNote({ images_used: 4, images_requested: 4 })).toBeNull()
    expect(refUsageNote({})).toBeNull()
    expect(refUsageNote(null)).toBeNull()
  })
})
