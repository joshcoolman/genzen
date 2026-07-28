import type {
  ModelCapability,
  UnifiedModel,
} from '#/features/ai-images/model-selector/types'
import {
  ALL_IMAGE_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  pickerId,
} from '#/features/ai-images/models'

export const UNIFIED_GENERATE_MODELS: Array<UnifiedModel> =
  ALL_IMAGE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    capability: 'generate' as const,
    displayPrice: m.displayPrice,
  }))

export const UNIFIED_EDIT_MODELS: Array<UnifiedModel> = EDIT_MODELS.map(
  (m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    capability: 'edit' as const,
    maxRefImages: m.maxRefImages,
    displayPrice: ALL_IMAGE_MODELS.find((im) => im.imageInputModelId === m.id)
      ?.displayPrice,
  }),
)

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
  return capability === 'generate' ? ALL_IMAGE_MODELS[0].id : EDIT_MODELS[0].id
}
