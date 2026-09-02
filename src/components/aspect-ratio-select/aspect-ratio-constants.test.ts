import { describe, expect, it } from 'vitest'
import { matchRatio } from './aspect-ratio-constants'

/**
 * Outpaint greys out the shape a picture already is, so a wrong answer here
 * either offers a pointless generation or withholds one that was wanted.
 */
describe('matchRatio', () => {
  it('recognises a ratio through thumbnail rounding', () => {
    // A 1920x1080 still, as its 400px-wide thumbnail measures.
    expect(matchRatio(400, 225)).toBe('16:9')
    expect(matchRatio(1920, 1080)).toBe('16:9')
  })

  it('keeps 3:2 and 16:9 apart', () => {
    // What FAL actually returns for a "16:9" request on several models.
    expect(matchRatio(1536, 1024)).toBe('3:2')
  })

  it('answers null for a shape the catalogue does not hold', () => {
    expect(matchRatio(1000, 300)).toBeNull()
    expect(matchRatio(0, 0)).toBeNull()
  })
})
