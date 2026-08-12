import { describe, expect, it } from 'vitest'
import { parseRange } from './http-range'

// The video scrub bar is the only reader, and a wrong range is worse than no
// range: the browser gets bytes it did not ask for and the player stalls with
// no error. These pin the cases a media element actually sends.
describe('parseRange', () => {
  it('parses an open-ended range, which is what a video element opens with', () => {
    expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 })
  })

  it('parses a bounded range', () => {
    expect(parseRange('bytes=200-499', 1000)).toEqual({ start: 200, end: 499 })
  })

  it('reads a suffix range from the end, not the start', () => {
    // `bytes=-500` means the last 500 bytes. Treating it as the first 500 is
    // the classic off-by-a-whole-file bug here.
    expect(parseRange('bytes=-500', 1000)).toEqual({ start: 500, end: 999 })
  })

  it('clamps an end past the object rather than reporting bytes it lacks', () => {
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('falls back to the whole object on anything unusual', () => {
    // Null means "serve everything" -- slower, but never wrong.
    expect(parseRange(null, 1000)).toBeNull()
    expect(parseRange('bytes=-', 1000)).toBeNull()
    expect(parseRange('bytes=0-10, 20-30', 1000)).toBeNull()
    expect(parseRange('items=0-10', 1000)).toBeNull()
    expect(parseRange('bytes=1000-1010', 1000)).toBeNull()
    expect(parseRange('bytes=500-200', 1000)).toBeNull()
    expect(parseRange('bytes=0-', 0)).toBeNull()
  })
})
