import type { ModelCapability, UnifiedModel } from './types'
import { ALL_IMAGE_MODELS, EDIT_MODELS } from '@/features/ai-images/models'

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

export function getModelsByCapability(
  capability: ModelCapability,
): Array<UnifiedModel> {
  return capability === 'generate'
    ? UNIFIED_GENERATE_MODELS
    : UNIFIED_EDIT_MODELS
}

export function getDefaultSelectedId(capability: ModelCapability): string {
  return capability === 'generate' ? ALL_IMAGE_MODELS[0].id : EDIT_MODELS[0].id
}
