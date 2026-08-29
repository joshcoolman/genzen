import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_FILTER_PREFIX,
  VIDEO_MODELS,
  aspectRatiosFor,
  endpointFor,
  estimateCostCents,
  expandVideoFilterId,
  frameCapacityFor,
  resolutionFor,
  resolutionsFor,
  supportsEndImage,
  takesFirstFrame,
  videoEndpointIds,
  videoFilterOptions,
  videoModelBySlug,
  videoModelNameFor,
  videoModelsByPrice,
} from './models'

const LTX = videoModelBySlug('ltx-2.5-fast')!
const H3 = videoModelBySlug('minimax-h3')!
const FLUX = videoModelBySlug('flux-3')!
const H3_MAX = videoModelBySlug('minimax-h3-max')!

/**
 * The lineup is three hand-verified records and the submit builds its whole
 * request out of them (#385), so what is worth pinning is the disagreements
 * between the models -- every one of them is a param that fails at FAL rather
 * than here if the record is wrong.
 */
describe('endpointFor', () => {
  it('routes to the image endpoint only when a first frame is set', () => {
    expect(endpointFor(LTX, false).id).toBe(
      'lightricks/ltx-2.5/text-to-video/fast',
    )
    expect(endpointFor(LTX, true).id).toBe(
      'lightricks/ltx-2.5/image-to-video/fast',
    )
  })

  it('sends Flux 3 to its separate first-last endpoint, and only with both', () => {
    // The case the two-slot shape could not express: a third endpoint, which
    // requires both frames and names the first one differently.
    expect(endpointFor(FLUX, true, false).id).toBe(
      'blackforestlabs/flux-3/image-to-video',
    )
    expect(endpointFor(FLUX, true, true).id).toBe(
      'blackforestlabs/flux-3/first-last-frame-to-video',
    )
    expect(endpointFor(FLUX, true, true).firstFrameParam).toBe(
      'start_image_url',
    )
  })

  it('keeps a model whose end frame rides on the image endpoint there', () => {
    // LTX and H3 take an optional `end_image_url` on the ordinary endpoint, so
    // a second frame must not route them anywhere new.
    expect(endpointFor(LTX, true, true).id).toBe(endpointFor(LTX, true).id)
    expect(endpointFor(H3, true, true).id).toBe(endpointFor(H3, true).id)
  })
})

describe('aspect ratios', () => {
  it('is empty for H3 with an image, because that endpoint has no such param', () => {
    // Empty means "no control", not "no valid values". Sending a ratio to this
    // endpoint is one param too many; the output follows the frame.
    expect(aspectRatiosFor(H3, true)).toEqual([])
    expect(aspectRatiosFor(H3, false).length).toBeGreaterThan(0)
  })

  it('offers `auto` only where there is an image to match', () => {
    for (const model of VIDEO_MODELS) {
      expect(aspectRatiosFor(model, false), model.slug).not.toContain('auto')
    }
    expect(aspectRatiosFor(LTX, true)).toContain('auto')
  })

  it('always gives a text-to-video endpoint something to choose from', () => {
    // With no image there is nothing for the model to follow, so an empty list
    // here would hide the control on the one mode that needs it.
    for (const model of VIDEO_MODELS) {
      expect(
        model.endpoints.textToVideo.aspectRatios.length,
        model.slug,
      ).toBeGreaterThan(0)
    }
  })
})

describe('entries', () => {
  it('keeps slugs unique', () => {
    const slugs = VIDEO_MODELS.map((m) => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every image endpoint a param to send the frame in', () => {
    // An endpoint that takes an image and does not say which param carries it
    // silently drops the frame and generates from the prompt alone.
    for (const model of VIDEO_MODELS) {
      const { withImage, withFirstAndLastImage } = model.endpoints
      // Absent entirely on a text-to-video-only model, which is a different
      // thing from present-and-unsendable.
      if (withImage) expect(withImage.firstFrameParam, model.slug).toBeTruthy()
      if (withFirstAndLastImage) {
        expect(withFirstAndLastImage.firstFrameParam, model.slug).toBeTruthy()
      }
    }
  })

  it('never claims an end frame on an endpoint that takes no first frame', () => {
    for (const model of VIDEO_MODELS) {
      for (const endpoint of Object.values(model.endpoints)) {
        if (endpoint.acceptsEndImage) {
          expect(endpoint.firstFrameParam, endpoint.id).toBeTruthy()
        }
      }
    }
  })

  it('offers the second slot only where something can receive it', () => {
    // The form shows a Last frame slot when this is true; a slot with nowhere
    // to send its picture is worse than no slot.
    for (const model of VIDEO_MODELS) {
      if (!supportsEndImage(model)) continue
      const reachable =
        model.endpoints.withFirstAndLastImage?.acceptsEndImage ||
        model.endpoints.withImage?.acceptsEndImage
      expect(reachable, model.slug).toBe(true)
    }
    expect(frameCapacityFor(FLUX)).toBe(2)
  })

  it('lists cheapest first for the picker, without moving the default', () => {
    // The same rule the image lineup follows. It matters more here: the spread
    // is $0.05 to $0.17 per *second*, so the bottom of the list is three times
    // the top for the same clip.
    const prices = videoModelsByPrice().map((m) => m.pricePerSecondCents)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    // Display only -- what you start on is a judgement about quality, and the
    // cheapest model is not automatically it.
    expect(DEFAULT_VIDEO_MODEL.slug).toBe(VIDEO_MODELS[0].slug)
  })

  it('starts every model on a duration it actually offers', () => {
    for (const model of VIDEO_MODELS) {
      expect(model.durations, model.slug).toContain(model.defaultDuration)
    }
  })
})

/**
 * The row-facing half (#398). These exist because Activity reasons about clips
 * by *model* while the column holds an *endpoint*, and getting that expansion
 * wrong is silent: the filter returns nothing and looks like "no runs yet".
 */
describe('endpoint identity', () => {
  it('names a row from any endpoint the model can be submitted to', () => {
    for (const model of VIDEO_MODELS) {
      for (const id of videoEndpointIds(model)) {
        expect(videoModelNameFor(id)).toBe(model.label)
      }
    }
  })

  it('returns undefined for an endpoint no video model claims', () => {
    // Undefined rather than the raw id, so Activity can fall back to the image
    // lineup instead of badging a still with a string that looks resolved.
    expect(videoModelNameFor('fal-ai/flux-pro/kontext')).toBeUndefined()
  })

  it('expands a filter id to every endpoint of that model', () => {
    const flux3 = VIDEO_MODELS.find((m) => m.slug === 'flux-3')!
    const ids = expandVideoFilterId(`${VIDEO_FILTER_PREFIX}flux-3`)
    // Three, not two: Flux 3 is the model that puts first+last frame on its own
    // endpoint, so a filter that only knew the first two would hide those runs.
    expect(ids).toEqual(videoEndpointIds(flux3))
    expect(ids).toHaveLength(3)
  })

  it('leaves an image endpoint id alone', () => {
    // Null means "not mine, pass it through" -- an image option's id already is
    // what the column holds.
    expect(expandVideoFilterId('fal-ai/flux-pro/kontext')).toBeNull()
  })

  it('expands an unknown slug to nothing rather than to everything', () => {
    // A retired video model must narrow the query to zero rows, not fall
    // through to an unfiltered list that looks like the filter did nothing.
    expect(expandVideoFilterId(`${VIDEO_FILTER_PREFIX}gone`)).toEqual([])
  })

  it('offers one filter option per model, cheapest first', () => {
    expect(videoFilterOptions().map((o) => o.label)).toEqual(
      videoModelsByPrice().map((m) => m.label),
    )
  })
})

/**
 * One model at a time, and it gets its whole capability.
 *
 * Multi-select (#417) intersected every control down to what all the ticked
 * models agreed on. These pin what replaced it: a model may now carry a
 * control none of the others has, and a model may refuse frames entirely --
 * both of which an intersection made unrepresentable.
 */
describe('per-model capability', () => {
  it('lets a text-to-video-only model say so', () => {
    // The one model in the lineup with no image endpoint. The form hides both
    // frame slots for it; the action drops a frame it is handed anyway.
    expect(takesFirstFrame(H3_MAX)).toBe(false)
    expect(H3_MAX.endpoints.withImage).toBeUndefined()
    for (const model of VIDEO_MODELS) {
      if (model === H3_MAX) continue
      expect(takesFirstFrame(model), model.slug).toBe(true)
    }
  })

  it('falls back to text-to-video rather than failing on a staged frame', () => {
    // Refusing would turn an ordinary model switch into an error the person
    // has to undo by clearing work they may still want.
    expect(endpointFor(H3_MAX, true, true)).toBe(H3_MAX.endpoints.textToVideo)
    expect(supportsEndImage(H3_MAX)).toBe(false)
    expect(frameCapacityFor(H3_MAX)).toBe(1)
  })

  it('offers a resolution control only where the model has tiers', () => {
    expect(resolutionsFor(H3_MAX).map((r) => r.id)).toEqual(['480P', '768P'])
    // Empty is "no control", not "no resolution" -- the others still send
    // their fixed one.
    for (const model of VIDEO_MODELS) {
      if (model === H3_MAX) continue
      expect(resolutionsFor(model), model.slug).toEqual([])
      expect(model.resolution, model.slug).toBeTruthy()
    }
  })

  it('names a tier the model actually offers, or its own', () => {
    // The estimate and the submit both go through this, so a price quoted at
    // 480P against a clip rendered at 768P is the bug it prevents.
    expect(resolutionFor(H3_MAX, '768P')).toBe('768P')
    expect(resolutionFor(H3_MAX, '2160p')).toBe(H3_MAX.resolution)
    expect(resolutionFor(LTX, '768P')).toBe(LTX.resolution)
    expect(resolutionFor(H3, undefined)).toBe(H3.resolution)
  })

  it('prices a clip at the tier it will actually render', () => {
    // 480P is 5c/s and 768P is 8c/s, so the same 6s clip is 30c or 48c -- the
    // whole reason the control exists.
    expect(estimateCostCents(H3_MAX, 6, '480P')).toBe(30)
    expect(estimateCostCents(H3_MAX, 6, '768P')).toBe(48)
    // A tier this model does not offer prices at its default, never at
    // another model's rate.
    expect(estimateCostCents(H3_MAX, 6, '1080p')).toBe(30)
    expect(estimateCostCents(LTX, 6, '768P')).toBe(LTX.pricePerSecondCents * 6)
  })

  it('keeps the default resolution inside the offered tiers', () => {
    for (const model of VIDEO_MODELS) {
      const tiers = resolutionsFor(model)
      if (tiers.length === 0) continue
      expect(
        tiers.map((r) => r.id),
        model.slug,
      ).toContain(model.resolution)
      // The headline price must be the default tier's, or the picker sorts on
      // a number the form never charges.
      const tier = tiers.find((r) => r.id === model.resolution)!
      expect(tier.pricePerSecondCents, model.slug).toBe(
        model.pricePerSecondCents,
      )
    }
  })
})
