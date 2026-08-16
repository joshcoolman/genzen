import type { ModelEntry } from '#/features/ai-images/models'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

/**
 * Canvas display order. Not a second registry -- slugs only, resolved against
 * `IMAGE_MODELS`, so no model fact is stated twice. It stays a list rather than
 * a flag on the entry because what it carries is an *order*, not a property.
 *
 * Canvas is image-in -> image-out: you generate from the image(s) selected on
 * the canvas. So every model here MUST accept an input image. `CANVAS_MODELS`
 * enforces that with a hard `supportsImageInput` filter as a safety net, even if
 * a text-only id is mistakenly added to this list. Models without image input
 * (e.g. the Kling/Recraft/Grok text-to-image entries) silently ignore the
 * selected image and generate from the prompt alone -- exactly what this list
 * exists to prevent.
 *
 * Not user-editable. To curate, edit this array.
 *
 * Adding a model here now means one slug, once `withImages` is set on its
 * entry in `ai-images/models.ts`.
 */
const CURATED_CANVAS_MODEL_SLUGS: Array<string> = [
  'nano-banana-2', // trusted; reasoning-guided
  'seedream-v4-5', // multi-image reference realism
  'flux-kontext-pro', // trusted; pro img2img refinement
]

/** Curated models, hard-gated to those that actually accept an input image. */
export const CANVAS_MODELS: Array<ModelEntry> = CURATED_CANVAS_MODEL_SLUGS.map(
  (slug) => IMAGE_MODELS.find((m) => m.slug === slug),
).filter((m): m is ModelEntry => !!m && m.withImages !== null)

/** Allowlisted model ids, post-gate. Pass to `useModelSelector({ allowedIds })`. */
export const CANVAS_MODEL_ALLOWED_IDS: Array<string> =
  CANVAS_MODELS.map(pickerId)

/** Default selected canvas model (first curated, gated entry). */
export const CANVAS_DEFAULT_MODEL = CANVAS_MODELS[0]
  ? pickerId(CANVAS_MODELS[0])
  : ''

/**
 * A curated canvas model's edit endpoint + how many reference images it accepts.
 * Used by the multi-image ("generate from a group") flow, where every selected
 * image is an equal reference and the model's `maxRefImages` is the hard cap.
 */
export interface CanvasEditModel {
  /** Edit endpoint id (e.g. `fal-ai/nano-banana-2/edit`) — what gets submitted. */
  id: string
  /** Display name (the base model's name). */
  name: string
  /** Max reference images this endpoint accepts. */
  maxRefImages: number
}

/**
 * Curated canvas models that have an edit endpoint (i.e. accept additional
 * reference images), paired with their per-model reference cap. Models without
 * an edit endpoint (e.g. FLUX Kontext Pro — single-image img2img only) are
 * excluded: they can't take a group. Order follows `CANVAS_MODELS`.
 */
export const CANVAS_EDIT_MODELS: Array<CanvasEditModel> = CANVAS_MODELS.filter(
  (m) => m.maxRefs > 0,
).map((m) => ({ id: m.withImages!, name: m.name, maxRefImages: m.maxRefs }))

/**
 * Largest reference cap across curated canvas edit models (Seedream → 10).
 */
export const CANVAS_GROUP_MAX_REFS = CANVAS_EDIT_MODELS.reduce(
  (max, m) => Math.max(max, m.maxRefImages),
  0,
)

/**
 * Largest multi-image selection canvas can generate from: one primary (Image 1,
 * the source) plus the biggest reference cap. Gates the group Generate pill —
 * beyond this, no model can hold the references so no pill shows.
 */
export const CANVAS_MAX_GROUP_SELECTION = CANVAS_GROUP_MAX_REFS + 1

/** Reference capacity of a canvas base model (0 if it has no edit endpoint). */
function canvasModelRefCap(m: ModelEntry): number {
  return m.maxRefs
}

/**
 * Curated canvas base-model ids whose edit endpoint can hold `refCount`
 * reference images. `refCount` 0 (a single image, no references) → every
 * curated model qualifies. Used to scope the model selector to models that fit
 * the current group, so a too-small model can't silently drop references.
 */
export function canvasModelIdsForRefCount(refCount: number): Array<string> {
  return CANVAS_MODELS.filter((m) => canvasModelRefCap(m) >= refCount).map(
    pickerId,
  )
}
