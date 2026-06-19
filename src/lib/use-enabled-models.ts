import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_TEXT_MODELS } from '@/lib/text-models'

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

export function isModelLocked(id: string): boolean {
  return (
    ALL_IMAGE_MODELS.some((m) => m.id === id && m.locked) ||
    ALL_TEXT_MODELS.some((m) => m.id === id && m.locked)
  )
}

export function resolveModel(preferredId: string, fallbackId: string): string {
  const disabled = readDisabledSet()
  if (isModelLocked(preferredId) || !disabled.has(preferredId)) {
    return preferredId
  }
  return fallbackId
}

export function useEnabledModels() {
  const [disabledIds, setDisabledIds] = useState<Set<string>>(readDisabledSet)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabledIds]))
  }, [disabledIds])

  const enabledImageModels = useMemo(
    () => ALL_IMAGE_MODELS.filter((m) => m.locked || !disabledIds.has(m.id)),
    [disabledIds],
  )

  const enabledTextModels = useMemo(
    () => ALL_TEXT_MODELS.filter((m) => m.locked || !disabledIds.has(m.id)),
    [disabledIds],
  )

  const isModelEnabled = useCallback(
    (id: string) => isModelLocked(id) || !disabledIds.has(id),
    [disabledIds],
  )

  const toggleModel = useCallback((id: string) => {
    if (isModelLocked(id)) return
    setDisabledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setDisabledIds(new Set())
  }, [])

  const enabledImageInputModels = useMemo(
    () => enabledImageModels.filter((m) => m.supportsImageInput),
    [enabledImageModels],
  )

  const enabledImageCount = enabledImageModels.length
  const enabledTextCount = enabledTextModels.length

  return {
    enabledImageModels,
    enabledImageInputModels,
    enabledTextModels,
    isModelEnabled,
    toggleModel,
    resetToDefaults,
    enabledImageCount,
    enabledTextCount,
  }
}
