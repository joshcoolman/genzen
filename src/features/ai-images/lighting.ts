import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'
import { getModelsByCapability } from '#/features/ai-images/model-selector/unified-models'

/**
 * Lighting: one picture in, the same picture under a named light (#563).
 *
 * **Shots' surface and Shots' two passes.** It is opened from the reference
 * strip and multi-selects, so every staged picture crossed with every effect
 * crossed with every model is its own generation. The prompt is written by
 * `server/write-lighting-prompt.action.ts`: a surface inventory once per
 * picture, then each effect bound to those surfaces. It shipped without a
 * writer -- the effect sent as written -- and that works on the subject the
 * effect was written from and nothing else. The action's header records the
 * whole of it; do not re-derive it here.
 *
 * **The models are the panel's, multi-selected.** Every model that takes an
 * image can attempt a relight, so the offer is the whole image-accepting
 * lineup rather than a curated few, drawn by the same `ModelSelector` the
 * sidebar uses: one picture through four models is one press, and comparing
 * them is most of the point. What is known already says why it is a control
 * rather than a constant -- Nano Banana 2 renders both effects, and Grok
 * renders the split field as a backdrop swap with the skin left neutral. That
 * is a finding about how far an instruction reaches, not a bad prompt, and the
 * only way to keep finding it is to be able to send an effect somewhere else.
 */

/**
 * Where the picker starts, and it is a judgement rather than a benchmark: Grok
 * Imagine is what these effects were being looked at on, it is what outpaint
 * settled on for reaching a picture with an instruction, and the hard rake was
 * its best result of the 2026-09-01 test. A starting point to argue with --
 * both effects also render on Nano Banana 2, which is one click away.
 */
export const DEFAULT_LIGHTING_MODEL_SLUG = 'grok-imagine-image-2'

/**
 * The one exclusion, and it is not a quality call: Z-Image Turbo's image
 * endpoint is denoise-from-image with a `strength` dial rather than instruct
 * editing, so a relight comes back as the reference at any strength -- the
 * same finding that keeps it out of outpaint and Shots. Its text-to-image
 * endpoint *does* render the hard rake, from nothing, which is a different
 * feature. Everything else that accepts an image is offered: whether a model
 * can hold an instruction this long is the open question, so answering it here
 * would delete the evidence.
 */
const EXCLUDED_SLUGS = new Set(['z-image-turbo'])

/**
 * The picker's lineup, as ids. The `sidebar` capability -- the same list the
 * panel offers -- keyed by picker id, so a submit carries the model and
 * `endpointFor` picks the edit endpoint off the source image.
 *
 * Passed as `allowedIds`, which preserves order, so the price sort
 * `getModelsByCapability` applies survives into the dialog. The default
 * selection rides separately on `defaultId` for exactly that reason: pinning
 * Grok to the head of this list to make it the default would break the one
 * thing the price column exists to show.
 */
export function lightingModelIds(): Array<string> {
  const excluded = new Set(
    IMAGE_MODELS.filter((m) => EXCLUDED_SLUGS.has(m.slug)).map(pickerId),
  )
  return getModelsByCapability('sidebar')
    .map((m) => m.id)
    .filter((id) => !excluded.has(id))
}

export function defaultLightingModelId(): string {
  const model = IMAGE_MODELS.find((m) => m.slug === DEFAULT_LIGHTING_MODEL_SLUG)
  if (!model) {
    throw new Error(
      `Default lighting model "${DEFAULT_LIGHTING_MODEL_SLUG}" is not in the lineup`,
    )
  }
  return pickerId(model)
}
