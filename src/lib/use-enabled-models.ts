'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { usePersistedState } from '#/lib/use-persisted-state'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

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
  return IMAGE_MODELS.some((m) => pickerId(m) === id && m.locked)
}

const EMPTY_DISABLED: Set<string> = new Set()

export function useEnabledModels() {
  const [disabledIds, setDisabledIds, hydrated] = usePersistedState(
    readDisabledSet,
    EMPTY_DISABLED,
  )

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabledIds]))
  }, [disabledIds, hydrated])

  const enabledImageModels = useMemo(
    () => IMAGE_MODELS.filter((m) => m.locked || !disabledIds.has(pickerId(m))),
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
    () => enabledImageModels.filter((m) => m.withImages),
    [enabledImageModels],
  )

  const enabledImageCount = enabledImageModels.length

  return {
    enabledImageModels,
    enabledImageInputModels,
    isModelEnabled,
    toggleModel,
    resetToDefaults,
    enabledImageCount,
  }
}
