import { describe, expect, it } from 'vitest'

import {
  CANVAS_EDIT_MODELS,
  CANVAS_GROUP_MAX_REFS,
  CANVAS_MODELS,
  canvasModelIdsForRefCount,
} from './canvas-models'
import { EDIT_MODELS, getModelName } from '@/features/ai-images/models'

const KONTEXT_PRO_ID = 'fal-ai/flux-pro/kontext/text-to-image'
const SEEDREAM_45_ID = 'fal-ai/bytedance/seedream/v4.5/text-to-image'

/**
 * Canvas is image-in -> image-out: every model offered here generates *from* the
 * selected image. Catching a mis-registered model is the whole point of these
 * invariants -- they fail fast on the exact data bug that shipped FLUX Kontext
 * Pro pointed at a text-to-image endpoint (source image silently dropped, output
 * generated from the prompt alone). Pure registry checks, no network/FAL calls.
 */
describe('canvas model registry invariants', () => {
  it('offers at least one model (the curated list never silently empties)', () => {
    expect(CANVAS_MODELS.length).toBeGreaterThan(0)
  })

  it('every canvas model flags supportsImageInput', () => {
    for (const m of CANVAS_MODELS) {
      expect(m.supportsImageInput).toBe(true)
    }
  })

  // The source image is sent to the model's `imageInputModelId` (edit/img2img)
  // endpoint. Without it, buildFalInput has no image param to fill and the image
  // is dropped -- the model runs as text-to-image. supportsImageInput alone does
  // NOT prevent this; the resolvable endpoint does.
  it.each(CANVAS_MODELS.map((m) => [m.name, m.imageInputModelId]))(
    '%s has an image-input endpoint so the source image is applied',
    (_name, imageInputModelId) => {
      expect(imageInputModelId).toBeTruthy()
    },
  )

  // Each resolved endpoint must be one we recognise -- either a first-class
  // EDIT_MODELS entry or a named alias in getModelName. This guards two things at
  // once: a typo'd/non-existent endpoint id, and an endpoint that would render as
  // a raw `fal-ai/...` string on the canvas label / in Activity.
  it.each(CANVAS_MODELS.map((m) => [m.name, m.imageInputModelId]))(
    '%s resolves to a recognised, human-named endpoint',
    (_name, imageInputModelId) => {
      expect(imageInputModelId).toBeTruthy()
      const id = imageInputModelId as string
      const recognised =
        EDIT_MODELS.some((e) => e.id === id) || getModelName(id) !== id
      expect(recognised).toBe(true)
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
    expect(ids).toEqual(CANVAS_MODELS.map((m) => m.id))
  })

  it('refCount 0 includes single-image-only models (e.g. Kontext Pro)', () => {
    expect(canvasModelIdsForRefCount(0)).toContain(KONTEXT_PRO_ID)
  })

  it('a group (refCount >= 1) drops models with no edit endpoint (Kontext Pro)', () => {
    expect(canvasModelIdsForRefCount(1)).not.toContain(KONTEXT_PRO_ID)
  })

  it('no model qualifies beyond the largest reference capacity', () => {
    expect(canvasModelIdsForRefCount(CANVAS_GROUP_MAX_REFS + 1)).toEqual([])
  })

  it('the highest-capacity model survives a max-size group (Seedream)', () => {
    expect(canvasModelIdsForRefCount(CANVAS_GROUP_MAX_REFS)).toContain(
      SEEDREAM_45_ID,
    )
  })

  it('CANVAS_EDIT_MODELS excludes single-image-only models (Kontext Pro)', () => {
    // Kontext Pro's img2img endpoint is single-image (not in EDIT_MODELS), so it
    // must not appear in the group-capable edit-model list.
    expect(CANVAS_EDIT_MODELS.some((m) => m.name === 'FLUX Kontext Pro')).toBe(
      false,
    )
  })

  it('every CANVAS_EDIT_MODELS entry maps to a real EDIT_MODELS endpoint', () => {
    for (const m of CANVAS_EDIT_MODELS) {
      expect(EDIT_MODELS.some((e) => e.id === m.id)).toBe(true)
      expect(m.maxRefImages).toBeGreaterThan(0)
    }
  })
})
