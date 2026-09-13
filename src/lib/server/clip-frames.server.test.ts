import { describe, expect, it } from 'vitest'
import { frameCountFor, sharpestIndexes } from './clip-frames.server'

describe('frameCountFor', () => {
  it('scales with duration between the clamps', () => {
    expect(frameCountFor(30)).toBe(15)
    expect(frameCountFor(90)).toBe(45)
  })

  it('fills the grid for a short clip and caps a long one', () => {
    // A 6s clip would sample three times at the even interval; the floor is
    // what makes it a contact sheet rather than a thumbnail.
    expect(frameCountFor(6)).toBe(12)
    expect(frameCountFor(60 * 30)).toBe(48)
  })

  it('stays under ~2s a tile across everything short form runs to', () => {
    // The reason the interval moved off five seconds: at that rate every clip
    // this app makes landed on the floor and the scaling never fired.
    for (const duration of [24, 45, 60, 90]) {
      expect(duration / frameCountFor(duration)).toBeLessThanOrEqual(2)
    }
  })
})

describe('sharpestIndexes', () => {
  it('steps off a blurred centre onto a clearly sharper neighbour', () => {
    expect(sharpestIndexes([1000, 100, 200, 100, 100, 900])).toEqual([0, 5])
  })

  it('holds the interval when the difference is marginal', () => {
    // The clustering this prevents: two neighbouring tiles, one drifting late
    // and the next early, for a few percent of encoded size.
    expect(sharpestIndexes([105, 100, 104, 106, 100, 103])).toEqual([1, 4])
  })

  it('still yields a tile for a trailing part-group', () => {
    expect(sharpestIndexes([1, 2, 3, 9])).toEqual([2, 3])
  })

  it('gives up a sharper frame rather than sit next to the last tile', () => {
    // Group one would pick index 2 and group two index 3 -- neighbouring
    // frames. The second falls back to its own interval instead.
    expect(sharpestIndexes([100, 100, 900, 900, 100, 100])).toEqual([2, 4])
  })
})
