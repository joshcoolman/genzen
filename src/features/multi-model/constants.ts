import {
  ALL_IMAGE_MODELS,
  KONTEXT_DEV_FALLBACK_ID,
  KONTEXT_DEV_ID,
} from '@/features/ai-images/models'

export const DEFAULT_COMPARE_MODEL_IDS = ALL_IMAGE_MODELS.map((m) => m.id)

export const KONTEXT_DEV = KONTEXT_DEV_ID
export const KONTEXT_DEV_FALLBACK = KONTEXT_DEV_FALLBACK_ID

export const MULTI_MODEL_STORAGE_KEY = 'genzen:multi-model'
