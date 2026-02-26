export type FrameStatus = 'idle' | 'generating' | 'completed' | 'error'
export type LastFrameMode = 'prompt' | 'image'

export type Generation = {
  id: string
  createdAt: string
  firstFrame: {
    id: string
    url: string | null
    status?: 'pending' | 'completed' | 'failed'
  } | null
  lastFrame: {
    id: string
    url: string | null
    status?: 'pending' | 'completed' | 'failed'
  } | null
  video: {
    id: string
    url: string | null
    status: 'pending' | 'completed' | 'failed'
  } | null
}

export interface FrameState {
  status: FrameStatus
  url: string | null
  recordId: string | null
  error: string | null
}

export const DEFAULT_FIRST_FRAME_PROMPT =
  'A visceral side-mounted camera angle hugging just above the wheel arch of a red-and-white 1980s Formula 1 car blasting out of the Monaco tunnel into blinding Mediterranean sunlight. Tire sidewalls ripple with speed, polished livery shimmers, chrome suspension arms catch the light. Vintage 35mm racing documentary aesthetic, natural motion blur, golden hour.'

export const FIRST_FRAME_MODELS = [
  { id: 'fal-ai/flux-pro/kontext/text-to-image', label: 'FLUX Kontext Pro' },
  { id: 'fal-ai/kling-image/o3/text-to-image', label: 'Kling Image O3' },
]

export const FLUX_KONTEXT_MODEL_ID = 'fal-ai/flux-pro/kontext/text-to-image'

export const LAST_FRAME_MODEL = 'nano-banana' as const
