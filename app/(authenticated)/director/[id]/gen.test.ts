import { describe, expect, it } from 'vitest'
import {
  GEN_FALLBACK_RATIO,
  MAX_REFS,
  clampRatio,
  genModel,
  genModelFor,
  genRatios,
  genRatiosFor,
  nearestGenRatio,
  refModel,
} from './gen'

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

describe('the model a reference switches to (#665)', () => {
  /* The whole reason a reference costs twenty times as much: it has to carry
     the continuity frame as well, or the clip stops continuing the run. If
     this endpoint ever loses its first-frame param, references here are
     pointless rather than expensive. */
  it('takes references and a starting frame on the same request', () => {
    const endpoint = genModelFor(1).endpoints.withReferences
    expect(endpoint?.firstFrameParam).toBe('start_image_url')
    expect(endpoint?.references?.param).toBe('image_urls')
  })

  it("goes back to the run's own model when every reference is dropped", () => {
    expect(genModelFor(0).slug).toBe(genModel().slug)
    expect(genModelFor(0).endpoints.withReferences).toBeUndefined()
  })

  it('caps references at what the endpoint accepts', () => {
    expect(MAX_REFS).toBe(refModel().endpoints.withReferences?.references?.max)
  })

  /* The pills are H3 Max Turbo's, which offers three shapes Kling refuses --
     and Kling's reference endpoint validates what it is sent, so an unclamped
     4:3 fails the submit rather than the picture. */
  it('brings a ratio the reference endpoint refuses back to one it names', () => {
    const offered = genRatiosFor(1)
    expect(offered).not.toContain('4:3')
    expect(offered).toContain(clampRatio(offered, '4:3'))
    expect(offered).toContain(clampRatio(offered, '21:9'))
    expect(clampRatio(offered, '16:9')).toBe('16:9')
    expect(clampRatio(genRatiosFor(0), '4:3')).toBe('4:3')
  })

  /* The duration pills are the base model's and do not move when a reference
     switches the model, which is only honest while every one of them is a
     duration the reference model takes. */
  it('offers no duration the reference model would refuse', () => {
    genModel().durations.forEach((seconds) => {
      expect(refModel().durations).toContain(seconds)
    })
  })
})
