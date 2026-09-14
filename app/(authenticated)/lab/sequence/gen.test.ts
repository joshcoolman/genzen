import { describe, expect, it } from 'vitest'
import { GEN_FALLBACK_RATIO, genModel, genRatios, nearestGenRatio } from './gen'

describe('the model a run generates with', () => {
  it('takes a first frame, which is what Add gen rests on', () => {
    const endpoint = genModel().endpoints.withImage
    expect(endpoint?.firstFrameParam).toBe('image_url')
  })

  /* The dialog shows no ratio control with a frame, and that is only correct
     while the endpoint has no ratio parameter to set. If fal adds one, the
     output stops following the frame and a generated clip can come back a
     different shape from the run it was made for. */
  it('follows the frame rather than taking a ratio', () => {
    expect(genModel().endpoints.withImage?.aspectRatios).toEqual([])
  })
})

describe('nearestGenRatio', () => {
  it('falls back with no run to measure', () => {
    expect(nearestGenRatio(null)).toBe(GEN_FALLBACK_RATIO)
    expect(nearestGenRatio(0)).toBe(GEN_FALLBACK_RATIO)
    expect(nearestGenRatio(Number.NaN)).toBe(GEN_FALLBACK_RATIO)
  })

  it('rounds a measured shape to one the model offers', () => {
    // 1280x720 and 1280x704 are both "16:9" out of the lineup.
    expect(nearestGenRatio(1280 / 720)).toBe('16:9')
    expect(nearestGenRatio(1280 / 704)).toBe('16:9')
    expect(nearestGenRatio(720 / 1280)).toBe('9:16')
    expect(nearestGenRatio(1)).toBe('1:1')
    expect(nearestGenRatio(1440 / 608)).toBe('21:9')
  })

  it('only ever answers with a ratio the endpoint accepts', () => {
    const offered = genRatios()
    ;[0.4, 0.75, 1.2, 1.9, 3.5].forEach((value) => {
      expect(offered).toContain(nearestGenRatio(value))
    })
  })
})
