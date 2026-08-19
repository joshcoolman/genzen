import type {
  ModelCapability,
  UnifiedModel,
} from '#/features/ai-images/model-selector/types'
import {
  IMAGE_MODELS,
  imageCapacityFor,
  pickerId,
} from '#/features/ai-images/models'

export const UNIFIED_GENERATE_MODELS: Array<UnifiedModel> = IMAGE_MODELS.map(
  (m) => ({
    id: pickerId(m),
    name: m.name,
    description: m.description,
    capability: 'generate' as const,
    price: m.price,
    capacity: imageCapacityFor(m.slug),
  }),
)

// Edit models are addressed by their image endpoint, and only models that take
// extra references belong here -- a single-image endpoint cannot hold a set.
export const UNIFIED_EDIT_MODELS: Array<UnifiedModel> = IMAGE_MODELS.filter(
  (m) => m.withImages && m.maxRefs > 0,
).map((m) => ({
  id: m.withImages!,
  name: m.name,
  description: m.description,
  capability: 'edit' as const,
  maxRefImages: m.maxRefs,
  // The image endpoint's price, where it differs -- this list *is* the image
  // context, so there is nothing ambiguous to resolve (#304).
  price: m.editPrice ?? m.price,
  capacity: imageCapacityFor(m.slug),
}))

// Sidebar models: every model that accepts an image, with the endpoint it
// switches to and how many extra references it takes.
export const UNIFIED_SIDEBAR_MODELS: Array<UnifiedModel> = IMAGE_MODELS.filter(
  (m) => m.withImages,
).map((m) => ({
  id: pickerId(m),
  name: m.name,
  description: m.description,
  capability: 'sidebar' as const,
  price: m.price,
  capacity: imageCapacityFor(m.slug),
  editId: m.textToImage ? (m.withImages ?? undefined) : undefined,
  maxRefImages: m.maxRefs,
}))

/**
 * Dollars per image, bare, for the picker's `$` column: `0.04`, `1.00`,
 * `0.005`. Three decimals below a cent, two above -- a flat `toFixed(2)` would
 * round the whole cheap tier to `0.01` and `0.00`, which is the one thing that
 * column exists to show.
 */
export function formatPrice(price?: number): string {
  if (price === undefined) return '—'
  return price.toFixed(price < 0.01 ? 3 : 2)
}

/**
 * Cheapest first. The lineup's own order is the order models were added, which
 * said nothing; sorting by price makes the cheap tier a band you can see, which
 * is why there is no "fast/cheap" grouping to maintain (#262, #341).
 *
 * Display only. The default selection is still `IMAGE_MODELS[0]`, and Canvas
 * passes `allowedIds`, whose order wins -- that list carries a curation, not a
 * price.
 */
function byPrice(models: Array<UnifiedModel>): Array<UnifiedModel> {
  return [...models].sort(
    (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  )
}

export function getModelsByCapability(
  capability: ModelCapability,
): Array<UnifiedModel> {
  if (capability === 'sidebar') return byPrice(UNIFIED_SIDEBAR_MODELS)
  return byPrice(
    capability === 'generate' ? UNIFIED_GENERATE_MODELS : UNIFIED_EDIT_MODELS,
  )
}

/**
 * The same models, priced for the endpoint that will actually run (#304).
 *
 * A megapixel-billed model costs about twice as much through its image
 * endpoint, because FAL's `processed megapixels` counts what you send as well
 * as what comes back. The estimate under Generate switches on this, so a `$`
 * column that did not would put two different prices for one click on screen at
 * once -- which is the drift this repo keeps having to unpick.
 *
 * Applied at the call site rather than inside `getModelsByCapability`, because
 * only the panel knows what is staged: the selector hook is built before the
 * generator that owns the reference set.
 */
export function pricedForImages(
  models: Array<UnifiedModel>,
  hasImages: boolean,
): Array<UnifiedModel> {
  if (!hasImages) return models
  return models.map((m) => {
    const entry = IMAGE_MODELS.find(
      (e) => pickerId(e) === m.id || e.withImages === m.id,
    )
    return entry?.editPrice ? { ...m, price: entry.editPrice } : m
  })
}

export function getDefaultSelectedId(capability: ModelCapability): string {
  if (capability === 'sidebar') return UNIFIED_SIDEBAR_MODELS[0]?.id ?? ''
  return capability === 'generate'
    ? pickerId(IMAGE_MODELS[0])
    : (UNIFIED_EDIT_MODELS[0]?.id ?? '')
}
