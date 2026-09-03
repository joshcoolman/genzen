import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

/**
 * The three models this page offers, and why it is three rather than the
 * lineup (#578).
 *
 * All nine were run against six hand-written specs on 2026-09-02, 54 images.
 * Six lost on the *room* rather than the face: both Seedreams draw the lamp
 * into a background the clause says is flat and evenly lit, GPT Image 2
 * plasticises skin at four times the price of the model that does it better,
 * and FLUX.2 Flash is beaten at its own price point by Z-Image Turbo. FLUX.2
 * Pro renders the best skin of anything tested and editorialises the person --
 * a candidate for later, not for the first three.
 *
 * **Z-Image Turbo is the default because the draft pass is the point.** A
 * session here is five or ten presses looking for a face worth pursuing, and
 * at half a cent a face that costs less than thinking about it. The other two
 * are what a face gets re-rendered on once it is worth eight cents.
 */
const SLUGS = [
  'z-image-turbo',
  'nano-banana-2',
  'grok-imagine-image-2',
] as const

export const DEFAULT_MODEL_SLUG = 'z-image-turbo'

/** The model a `+` press uses, with no dialog and no choice. */
export const QUICK_MODEL_SLUG = 'grok-imagine-image-2'

export interface PeopleModel {
  id: string
  name: string
  /** Dollars an image, for the label beside the toggle. Null where the lineup
   *  has no published figure -- all three carry one today, and a toggle that
   *  printed "$0.000" for a model FAL never priced would be inventing one. */
  price: number | null
}

function modelFor(slug: string): PeopleModel {
  const entry = IMAGE_MODELS.find((m) => m.slug === slug)
  if (!entry) throw new Error(`People lab: "${slug}" is not in the lineup`)
  return { id: pickerId(entry), name: entry.name, price: entry.price ?? null }
}

export const PEOPLE_MODELS: Array<PeopleModel> = SLUGS.map(modelFor)

export const defaultModelId = (): string => modelFor(DEFAULT_MODEL_SLUG).id
export const quickModelId = (): string => modelFor(QUICK_MODEL_SLUG).id
