import {
  ALL_IMAGE_MODELS,
  FLUX_KONTEXT_PRO_ID,
} from '@/features/ai-images/models'

export type FrameStatus = 'idle' | 'generating' | 'completed' | 'error'
export type FrameMode = 'prompt' | 'image'

export const FIRST_FRAME_MODELS = [
  {
    id: FLUX_KONTEXT_PRO_ID,
    label: ALL_IMAGE_MODELS.find((m) => m.id === FLUX_KONTEXT_PRO_ID)!.name,
  },
  {
    id: 'fal-ai/kling-image/o3/text-to-image',
    label: 'Kling Image O3',
  },
]

export const FLUX_KONTEXT_MODEL_ID = FLUX_KONTEXT_PRO_ID
