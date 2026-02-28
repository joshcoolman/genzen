import { FIRST_FRAME_MODELS, FLUX_KONTEXT_MODEL_ID } from './types'
import type { FrameMode } from './types'

export const FIRST_FRAME_MODEL_FOR_MODE: Record<FrameMode, string> = {
  prompt: FIRST_FRAME_MODELS[1].id, // Kling Image O3
  image: FLUX_KONTEXT_MODEL_ID, // FLUX Kontext Pro
}
