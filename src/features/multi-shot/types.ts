export interface MultiShotElement {
  id: string
  frontalImageUrl: string
  label: string
}

export interface Shot {
  id: string
  prompt: string
  duration: number
}

export interface MultiShotSettings {
  aspectRatio: '16:9' | '9:16' | '1:1'
  shotType: 'customize' | 'intelligent'
  generateAudio: boolean
  startImageUrl?: string
}

export interface MultiShotSequence {
  id: string
  name: string
  shots: Array<Shot>
  elements: Array<MultiShotElement>
  settings: MultiShotSettings
  videoRecordId: string | null
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed'
  estimatedCost: number | null
  videoUrl: string | null
  createdAt: string
}

export const DEFAULT_SETTINGS: MultiShotSettings = {
  aspectRatio: '16:9',
  shotType: 'customize',
  generateAudio: true,
}

export const MAX_SHOTS = 6
export const MAX_TOTAL_DURATION = 15
export const MIN_SHOT_DURATION = 3
export const PRICE_PER_SEC_AUDIO = 0.168

export interface GenerationRecord {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl: string | null
  error: string | null
  createdAt: string
  thumbnailUrl: string | null
}

export const MULTISHOT_FAL_MODEL = 'fal-ai/kling-video/v3/pro/image-to-video'
