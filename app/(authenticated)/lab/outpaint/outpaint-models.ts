import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

/**
 * Models this page does not offer, and why.
 *
 * **Z-Image Turbo cannot outpaint, and the lineup already says so.** Its image
 * endpoint is denoise-from-image with a `strength` dial rather than instruct
 * editing -- `models.ts` records that telling it to recolour a mug returns the
 * same mug at any strength. It is in the lineup so an attached image is used
 * rather than dropped, which is a different job from being asked to extend a
 * frame. Offering it here produces a result that answers neither of the page's
 * two questions: it is not evidence about the instruction and not evidence
 * about the model.
 *
 * A list of slugs rather than a derived rule, because the thing that would
 * derive it -- whether the endpoint takes an aspect ratio at all -- is fetched
 * from FAL's OpenAPI at submit time, server side, and the picker is a client
 * component. When a second model earns a place on this list, that is the point
 * to work out whether the rule can be computed instead of remembered.
 */
const EXCLUDED_SLUGS = ['z-image-turbo']

/**
 * What the picker offers: every model with an image endpoint, cheapest first,
 * minus the ones above. Pass to `useModelSelector({ allowedIds })`, whose order
 * this is.
 */
export const OUTPAINT_MODEL_IDS: Array<string> = IMAGE_MODELS.filter(
  (m) => m.withImages && !EXCLUDED_SLUGS.includes(m.slug),
)
  .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  .map(pickerId)
