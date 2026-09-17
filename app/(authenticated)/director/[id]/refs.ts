import type { RefKind } from '../_lib/types'
import { IMAGE_MODELS } from '#/features/ai-images/models'

/**
 * Everything a reference sheet is made with (#690).
 *
 * **Locked down on purpose.** This is not Images: no source/reference roles, no
 * resolution, no enhance, and no aspect control. An opinionated workflow sets
 * a standard it can pivot from later, and the standard is 16:9 -- a sheet is
 * something you look at wide, whatever shape the session's clips are. A 9:16
 * chat shows very little of a location, which is the case the sheet exists to
 * answer.
 */
export const REF_RATIO = '16:9'

/**
 * Nano Banana 2 does the extraction, alone.
 *
 * It takes thirteen references beyond the first, which is more than a handful
 * of stills will ever need, and the extraction sends two or three per element.
 * No picker here because nothing is being compared yet -- the comparison is
 * what New from this is for.
 */
export const EXTRACT_MODEL_SLUG = 'nano-banana-2'

/**
 * The three a derive may tick, every one of which takes references.
 *
 * A multi-select rather than a picker: each model ticked is one generation, so
 * ticking all three adds three assets to compare side by side. That is the
 * whole reason a choice exists here at all.
 */
export const DERIVE_MODEL_SLUGS = [
  'nano-banana-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const

export interface RefModelOption {
  slug: string
  name: string
  /** Dollars for one image on the endpoint a derive uses, which is always the
   *  image endpoint: there is always a reference. */
  price: number | undefined
}

export function deriveModelOptions(): Array<RefModelOption> {
  return DERIVE_MODEL_SLUGS.map((slug) => {
    const model = IMAGE_MODELS.find((m) => m.slug === slug)
    return {
      slug,
      name: model?.name ?? slug,
      price: model?.editPrice ?? model?.price,
    }
  })
}

export const KIND_LABEL: Record<RefKind, string> = {
  characters: 'Characters',
  locations: 'Locations',
}

/** Singular, for the one-sheet sentences: "Extract characters" is the button,
 *  "this character" is what a derive is started from. */
export const KIND_NOUN: Record<RefKind, string> = {
  characters: 'character',
  locations: 'location',
}
