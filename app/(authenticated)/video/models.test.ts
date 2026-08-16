import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODELS,
  aspectRatiosFor,
  endpointFor,
  frameCapacityFor,
  supportsEndImage,
  videoModelBySlug,
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
