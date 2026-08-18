import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_FILTER_PREFIX,
  VIDEO_MODELS,
  aspectRatiosFor,
  endpointFor,
  estimateCostCents,
  estimateMultiCostCents,
  expandVideoFilterId,
  frameCapacityFor,
  sharedAspectRatios,
  sharedDurations,
  supportsEndImage,
  videoEndpointIds,
  videoFilterOptions,
  videoModelBySlug,
  videoModelNameFor,
  videoModelsByPrice,
} from './models'

const LTX = videoModelBySlug('ltx-2.5-fast')!
const H3 = videoModelBySlug('minimax-h3')!
const FLUX = videoModelBySlug('flux-3')!

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
      expect(withImage.firstFrameParam, model.slug).toBeTruthy()
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
        model.endpoints.withImage.acceptsEndImage
      expect(reachable, model.slug).toBe(true)
    }
    expect(frameCapacityFor(FLUX)).toBe(2)
  })

  it('lists cheapest first for the picker, without moving the default', () => {
    // The same rule the image lineup follows. It matters more here: the spread
    // is $0.08 to $0.17 per *second*, so the bottom of the list is twice the
    // top for the same clip.
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
 * Multi-model selection (#417). These matter because getting an intersection
 * wrong fails at FAL rather than here: a duration one model rejects is a
 * queued request that errors after you have already paid attention to it.
 */
describe('multi-model settings', () => {
  it('offers only durations every selected model takes', () => {
    const shared = sharedDurations([LTX, H3, FLUX])
    for (const d of shared) {
      expect(LTX.durations).toContain(d)
      expect(H3.durations).toContain(d)
      expect(FLUX.durations).toContain(d)
    }
    // LTX starts at 6, so H3's 5 must not survive; H3 tops out at 15, so LTX's
    // 18 and 20 must not either.
    expect(shared).not.toContain(5)
    expect(shared).not.toContain(18)
    expect(shared).not.toContain(20)
  })

  it('leaves one model alone', () => {
    expect(sharedDurations([LTX])).toEqual(LTX.durations)
  })

  it('excludes a model with no aspect control instead of emptying the list', () => {
    // H3's image endpoint has no `aspect_ratio` param at all, which means
    // "there is no control" -- not "no ratio works". Intersecting it literally
    // would strip the control from LTX as well and hand FAL its default for a
    // model perfectly able to honour a choice.
    const shared = sharedAspectRatios([LTX, H3], true)
    expect(aspectRatiosFor(H3, true)).toEqual([])
    expect(shared.length).toBeGreaterThan(0)
    expect(shared).toEqual(aspectRatiosFor(LTX, true))
  })

  it('intersects the models that do have aspect options', () => {
    const shared = sharedAspectRatios([LTX, FLUX], true)
    // LTX offers auto/16:9/9:16; Flux 3 offers those and more. The narrower
    // list wins, and nothing outside it is offered.
    expect(shared).toEqual(['auto', '16:9', '9:16'])
  })

  it('is empty when no model is selected', () => {
    expect(sharedDurations([])).toEqual([])
    expect(sharedAspectRatios([], true)).toEqual([])
  })

  it('sums the cost across models rather than scaling one', () => {
    // The models are priced differently, so a single figure times a count
    // would be wrong the moment two models disagree. LTX is 9c/s and Flux 3
    // is 17c/s, so 6s of both is 54 + 102.
    expect(estimateMultiCostCents([LTX, FLUX], 6, 1)).toBe(
      estimateCostCents(LTX, 6) + estimateCostCents(FLUX, 6),
    )
  })

  it('multiplies by prompts, one clip per model each', () => {
    const one = estimateMultiCostCents([LTX, FLUX], 6, 1)
    expect(estimateMultiCostCents([LTX, FLUX], 6, 3)).toBe(one * 3)
  })

  it('costs nothing with no model selected', () => {
    expect(estimateMultiCostCents([], 6, 4)).toBe(0)
  })
})
