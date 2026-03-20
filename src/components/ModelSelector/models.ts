import type { ModelCapability, UnifiedModel } from './types'
import {
  ALL_IMAGE_MODELS,
  EDIT_MODELS,
  IMAGE_INPUT_MODELS,
} from '@/features/ai-images/models'

export const UNIFIED_GENERATE_MODELS: Array<UnifiedModel> =
  ALL_IMAGE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    capability: 'generate' as const,
  }))

export const UNIFIED_EDIT_MODELS: Array<UnifiedModel> = EDIT_MODELS.map(
  (m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    capability: 'edit' as const,
    maxRefImages: m.maxRefImages,
  }),
)

// Sidebar models: all image-input-capable models with their edit endpoints + maxRefImages
export const UNIFIED_SIDEBAR_MODELS: Array<UnifiedModel> =
  IMAGE_INPUT_MODELS.map((m) => {
    const editModel = m.imageInputModelId
      ? EDIT_MODELS.find((e) => e.id === m.imageInputModelId)
      : undefined
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      capability: 'sidebar' as const,
      editId: m.imageInputModelId,
      maxRefImages: editModel?.maxRefImages ?? 0,
    }
  })

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
