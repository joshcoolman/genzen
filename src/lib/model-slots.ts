import { useCallback, useEffect, useState } from 'react'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import {
  ALL_VIDEO_MODELS,
  DEFAULT_VIDEO_MODEL,
} from '@/features/ai-video/video-models'

export type SlotTier = 'draft' | 'quality' | 'video'

export interface ModelSlots {
  draft: string
  quality: string
  video: string
}

const SLOT_DEFAULTS: ModelSlots = {
  draft: 'fal-ai/flux-kontext/dev',
  quality: 'fal-ai/nano-banana-2',
  video: DEFAULT_VIDEO_MODEL,
}

const STORAGE_KEY = 'genzen:model-slots'

function readSlots(): ModelSlots {
  if (typeof window === 'undefined') return SLOT_DEFAULTS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return SLOT_DEFAULTS
    const parsed = JSON.parse(stored) as Partial<ModelSlots>
    return {
      draft: validateImageModel(parsed.draft) ?? SLOT_DEFAULTS.draft,
      quality: validateImageModel(parsed.quality) ?? SLOT_DEFAULTS.quality,
      video: validateVideoModel(parsed.video) ?? SLOT_DEFAULTS.video,
    }
  } catch {
    return SLOT_DEFAULTS
  }
}

function validateImageModel(id: string | undefined): string | null {
  if (!id) return null
  return ALL_IMAGE_MODELS.some((m) => m.id === id) ? id : null
}

function validateVideoModel(id: string | undefined): string | null {
  if (!id) return null
  return ALL_VIDEO_MODELS.some((m) => m.id === id) ? id : null
}

export function useModelSlots() {
  const [slots, setSlots] = useState<ModelSlots>(readSlots)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
  }, [slots])

  const setSlot = useCallback((tier: SlotTier, modelId: string) => {
    setSlots((prev) => ({ ...prev, [tier]: modelId }))
  }, [])

  return { slots, setSlot }
}

export { SLOT_DEFAULTS }
