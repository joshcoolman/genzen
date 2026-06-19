import type {ImageModel} from '@/features/ai-images/models';
import { ALL_IMAGE_MODELS  } from '@/features/ai-images/models'

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
 * `ai-images/models.ts` (which would also change Kling's behavior in AI Images),
 * so it's deferred to a deliberate follow-up.
 */
const CURATED_CANVAS_MODEL_IDS: Array<string> = [
  'fal-ai/nano-banana-2', // trusted; reasoning-guided, direct Google route
  'fal-ai/gpt-image-2', // trusted; premium OpenAI
  'fal-ai/gpt-image-1.5', // trusted; OpenAI quality
  'fal-ai/flux-2-pro', // best photorealism, supports reference images
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
