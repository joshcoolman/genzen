import { describe, expect, it } from 'vitest'

import {
  CANVAS_EDIT_MODELS,
  CANVAS_GROUP_MAX_REFS,
  CANVAS_MODELS,
  canvasModelIdsForRefCount,
} from './canvas-models'
import {
  IMAGE_MODELS,
  getModelName,
  pickerId,
} from '#/features/ai-images/models'

/* **No curated canvas model holds only one image any more.** FLUX Kontext Pro
   was the example these two cases were written around, and #304 replaced it
   with FLUX.2 Pro, which takes eight. The rule still matters -- a one-image
   model must appear at refCount 0 and vanish at refCount 1 -- so it is asserted
   against the registry rather than a named id, and holds again the day such a
   model is curated. */
const singleImageIds = () =>
  CANVAS_MODELS.filter((m) => m.maxRefs === 0).map(pickerId)

/**
 * Canvas is image-in -> image-out: every model offered here generates *from* the
 * selected image. Catching a mis-registered model is the whole point of these
 * invariants -- they fail fast on the exact data bug that once shipped FLUX
 * Kontext Pro pointed at a text-to-image endpoint (source image silently
 * dropped, output generated from the prompt alone). Pure registry checks, no
 * network/FAL calls.
 */
describe('canvas model registry invariants', () => {
  it('offers at least one model (the curated list never silently empties)', () => {
    expect(CANVAS_MODELS.length).toBeGreaterThan(0)
  })

  it('every canvas model has an image endpoint', () => {
    for (const m of CANVAS_MODELS) {
      expect(m.withImages, m.slug).not.toBeNull()
    }
  })

  // The source image is sent to the model's `withImages` endpoint. Without one,
  // buildFalInput has no image param to fill and the image is dropped -- the
  // model runs as text-to-image.
  it.each(CANVAS_MODELS.map((m) => [m.name, m.withImages]))(
    '%s has an image endpoint so the source image is applied',
    (_name, withImages) => {
      expect(withImages).toBeTruthy()
    },
  )

  // Each resolved endpoint must be one getModelName can name. This guards a
  // typo'd endpoint id and an endpoint that would render as a raw `fal-ai/...`
  // string on the canvas label and in Activity.
  it.each(CANVAS_MODELS.map((m) => [m.name, m.withImages]))(
    '%s resolves to a recognised, human-named endpoint',
    (_name, withImages) => {
      const id = withImages as string
      expect(getModelName(id)).not.toBe(id)
    },
  )
})

/**
 * The group ("generate from N images") flow scopes the model selector to models
 * whose edit endpoint can actually hold the reference count, so a too-small model
 * can't silently truncate references (same silent-failure class as the canvas
 * generation fixes). These guard that gating.
 */
describe('canvas reference-capacity gating', () => {
  it('a single image (refCount 0) exposes every curated model', () => {
    const ids = canvasModelIdsForRefCount(0)
    expect(ids).toEqual(CANVAS_MODELS.map(pickerId))
  })

  it('refCount 0 includes single-image-only models', () => {
    const ids = canvasModelIdsForRefCount(0)
    for (const id of singleImageIds()) expect(ids).toContain(id)
  })

  it('a group (refCount >= 1) drops models that hold only one image', () => {
    const ids = canvasModelIdsForRefCount(1)
    for (const id of singleImageIds()) expect(ids).not.toContain(id)
  })

  it('no model qualifies beyond the largest reference capacity', () => {
    expect(canvasModelIdsForRefCount(CANVAS_GROUP_MAX_REFS + 1)).toEqual([])
  })

  it('the model that sets the maximum survives a max-size group', () => {
    // Named by derivation rather than by model: which model holds the most
    // references changes (Seedream until #459, Nano Banana 2 after it), and a
    // hardcoded name turns that into a failing test rather than a raised cap.
    const widest = CANVAS_MODELS.filter(
      (m) => m.maxRefs === CANVAS_GROUP_MAX_REFS,
    )
    expect(widest.length).toBeGreaterThan(0)
    const surviving = canvasModelIdsForRefCount(CANVAS_GROUP_MAX_REFS)
    for (const m of widest) expect(surviving).toContain(pickerId(m))
  })

  it('CANVAS_EDIT_MODELS excludes single-image-only models', () => {
    // Their img2img endpoint takes one image, which the source occupies
    // (maxRefs 0), so they must not appear in the group-capable edit-model list.
    // `CANVAS_EDIT_MODELS` is derived as `maxRefs > 0`, so a one-image model
    // is excluded by construction -- asserted here so the derivation cannot
    // change without this failing.
    for (const m of CANVAS_EDIT_MODELS) {
      expect(m.maxRefImages).toBeGreaterThan(0)
    }
  })

  it('every CANVAS_EDIT_MODELS entry maps to a real image endpoint', () => {
    for (const m of CANVAS_EDIT_MODELS) {
      const owner = IMAGE_MODELS.find((e) => e.withImages === m.id)
      expect(owner, m.id).toBeDefined()
      expect(owner!.maxRefs).toBeGreaterThan(0)
      expect(m.maxRefImages).toBe(owner!.maxRefs)
    }
  })
})
