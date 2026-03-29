import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_VIDEO_MODELS } from '@/features/ai-video/video-models'

const STORAGE_KEY = 'genzen:disabled-models'

function readDisabledSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    return new Set(JSON.parse(stored) as Array<string>)
  } catch {
    return new Set()
  }
}

export function useEnabledModels() {
  const [disabledIds, setDisabledIds] = useState<Set<string>>(readDisabledSet)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabledIds]))
  }, [disabledIds])

  const enabledImageModels = useMemo(
    () => ALL_IMAGE_MODELS.filter((m) => !disabledIds.has(m.id)),
    [disabledIds],
  )

  const enabledVideoModels = useMemo(
    () => ALL_VIDEO_MODELS.filter((m) => !disabledIds.has(m.id)),
    [disabledIds],
  )

  const isModelEnabled = useCallback(
    (id: string) => !disabledIds.has(id),
    [disabledIds],
  )

  const toggleModel = useCallback((id: string) => {
    setDisabledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      // Min-1 enforcement: don't disable the last model in a group
      const isImage = ALL_IMAGE_MODELS.some((m) => m.id === id)
      const isVideo = ALL_VIDEO_MODELS.some((m) => m.id === id)
      if (isImage) {
        const remainingImage = ALL_IMAGE_MODELS.filter(
          (m) => !next.has(m.id) && m.id !== id,
        )
        if (remainingImage.length === 0) return prev
      }
      if (isVideo) {
        const remainingVideo = ALL_VIDEO_MODELS.filter(
          (m) => !next.has(m.id) && m.id !== id,
        )
        if (remainingVideo.length === 0) return prev
      }
      next.add(id)
      return next
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setDisabledIds(new Set())
  }, [])

  const enabledImageCount = enabledImageModels.length
  const enabledVideoCount = enabledVideoModels.length

  return {
    enabledImageModels,
    enabledVideoModels,
    isModelEnabled,
    toggleModel,
    resetToDefaults,
    enabledImageCount,
    enabledVideoCount,
  }
}
