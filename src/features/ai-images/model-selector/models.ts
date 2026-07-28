import type {
  ModelCapability,
  UnifiedModel,
} from '#/features/ai-images/model-selector/types'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

export const UNIFIED_GENERATE_MODELS: Array<UnifiedModel> = IMAGE_MODELS.map(
  (m) => ({
    id: pickerId(m),
    name: m.name,
    description: m.description,
    capability: 'generate' as const,
    displayPrice: m.displayPrice,
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
  displayPrice: m.displayPrice,
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
  editId: m.textToImage ? (m.withImages ?? undefined) : undefined,
  maxRefImages: m.maxRefs,
  displayPrice: m.displayPrice,
}))

export function getModelsByCapability(
  capability: ModelCapability,
): Array<UnifiedModel> {
  if (capability === 'sidebar') return UNIFIED_SIDEBAR_MODELS
  return capability === 'generate'
    ? UNIFIED_GENERATE_MODELS
    : UNIFIED_EDIT_MODELS
}

export function getDefaultSelectedId(capability: ModelCapability): string {
  if (capability === 'sidebar') return UNIFIED_SIDEBAR_MODELS[0]?.id ?? ''
  return capability === 'generate'
    ? pickerId(IMAGE_MODELS[0])
    : (UNIFIED_EDIT_MODELS[0]?.id ?? '')
}
