import type { ModelCapability, UnifiedModel } from './types'
import {
  ALL_IMAGE_MODELS,
  DEFAULT_VISIBLE_MODELS,
  EDIT_MODELS,
} from '@/features/ai-images/models'

export const UNIFIED_GENERATE_MODELS: Array<UnifiedModel> =
  ALL_IMAGE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    capability: 'generate' as const,
    category: m.category,
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

export const ALL_UNIFIED_MODELS: Array<UnifiedModel> = [
  ...UNIFIED_GENERATE_MODELS,
  ...UNIFIED_EDIT_MODELS,
]

export function getModelsByCapability(
  capability: ModelCapability,
): Array<UnifiedModel> {
  return capability === 'generate'
    ? UNIFIED_GENERATE_MODELS
    : UNIFIED_EDIT_MODELS
}

export const DEFAULT_VISIBLE_GENERATE_IDS = DEFAULT_VISIBLE_MODELS.map(
  (m) => m.id,
)

export const DEFAULT_VISIBLE_EDIT_IDS = EDIT_MODELS.map((m) => m.id)

export function getDefaultVisibleIds(
  capability: ModelCapability,
): Array<string> {
  return capability === 'generate'
    ? DEFAULT_VISIBLE_GENERATE_IDS
    : DEFAULT_VISIBLE_EDIT_IDS
}

export function getDefaultSelectedId(capability: ModelCapability): string {
  return capability === 'generate' ? ALL_IMAGE_MODELS[0].id : EDIT_MODELS[0].id
}
