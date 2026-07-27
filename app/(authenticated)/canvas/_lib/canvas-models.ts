import type { ImageModel } from '#/features/ai-images/models'
import { ALL_IMAGE_MODELS, EDIT_MODELS } from '#/features/ai-images/models'

/**
 * Curated, code-based allowlist of models surfaced in Canvas generation.
 *
 * Canvas is image-in -> image-out: you generate from the image(s) selected on
 * the canvas. So every model here MUST accept an input image. `CANVAS_MODELS`
 * enforces that with a hard `supportsImageInput` filter as a safety net, even if
 * a text-only id is mistakenly added to this list. Models without image input
 * (e.g. the Kling/Recraft/Grok text-to-image entries) silently ignore the
 * selected image and generate from the prompt alone -- exactly what this list
 * exists to prevent.
 *
 * Not user-editable. To curate, edit this array (reference ids from `models.ts`).
 * Order here is the display order in the canvas model selector.
 *
 * NOTE: Kling V3 has an image-to-image variant on FAL
 * (`fal-ai/kling-image/v3/image-to-image`), but the shared registry only carries
 * Kling's text-to-image entries today. Adding it means editing
 * `ai-images/models.ts` (which would also change Kling's behavior in Images),
 * so it's deferred to a deliberate follow-up.
 */
const CURATED_CANVAS_MODEL_IDS: Array<string> = [
  'fal-ai/nano-banana-2', // trusted; reasoning-guided
  'fal-ai/gpt-image-2', // trusted; premium OpenAI
  'fal-ai/gpt-image-1.5', // trusted; OpenAI quality
  'fal-ai/bytedance/seedream/v4.5/text-to-image', // multi-image reference realism
  'fal-ai/flux-pro/kontext/text-to-image', // trusted; pro img2img refinement
]

/** Curated models, hard-gated to those that actually accept an input image. */
export const CANVAS_MODELS: Array<ImageModel> = CURATED_CANVAS_MODEL_IDS.map(
  (id) => ALL_IMAGE_MODELS.find((m) => m.id === id),
).filter((m): m is ImageModel => !!m && m.supportsImageInput === true)

/** Allowlisted model ids, post-gate. Pass to `useModelSelector({ allowedIds })`. */
export const CANVAS_MODEL_ALLOWED_IDS: Array<string> = CANVAS_MODELS.map(
  (m) => m.id,
)

/** Default selected canvas model (first curated, gated entry). */
export const CANVAS_DEFAULT_MODEL = CANVAS_MODELS[0]?.id ?? ''

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
export const CANVAS_EDIT_MODELS: Array<CanvasEditModel> = CANVAS_MODELS.flatMap(
  (m) => {
    if (!m.imageInputModelId) return []
    const edit = EDIT_MODELS.find((e) => e.id === m.imageInputModelId)
    return edit
      ? [{ id: edit.id, name: m.name, maxRefImages: edit.maxRefImages }]
      : []
  },
)

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
function canvasModelRefCap(m: ImageModel): number {
  if (!m.imageInputModelId) return 0
  return (
    EDIT_MODELS.find((e) => e.id === m.imageInputModelId)?.maxRefImages ?? 0
  )
}

/**
 * Curated canvas base-model ids whose edit endpoint can hold `refCount`
 * reference images. `refCount` 0 (a single image, no references) → every
 * curated model qualifies. Used to scope the model selector to models that fit
 * the current group, so a too-small model can't silently drop references.
 */
export function canvasModelIdsForRefCount(refCount: number): Array<string> {
  return CANVAS_MODELS.filter((m) => canvasModelRefCap(m) >= refCount).map(
    (m) => m.id,
  )
}
