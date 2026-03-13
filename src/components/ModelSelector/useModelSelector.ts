import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getDefaultSelectedId,
  getDefaultVisibleIds,
  getModelsByCapability,
} from './models'
import type { ModelCapability, SelectionMode, UnifiedModel } from './types'

interface UseModelSelectorOptions {
  capability: ModelCapability
  mode: SelectionMode
}

function storageKey(capability: ModelCapability, suffix: string) {
  return `genzen:model-selector:${capability}:${suffix}`
}

function readStorage<T>(key: string, fallback: T, validate?: (v: T) => T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as T
    return validate ? validate(parsed) : parsed
  } catch {
    return fallback
  }
}

export function useModelSelector({
  capability,
  mode,
}: UseModelSelectorOptions) {
  const allModels = useMemo(
    () => getModelsByCapability(capability),
    [capability],
  )
  const allIds = useMemo(() => allModels.map((m) => m.id), [allModels])

  const [visibleIds, setVisibleIds] = useState<Array<string>>(() => {
    return readStorage(
      storageKey(capability, 'visible'),
      getDefaultVisibleIds(capability),
      (ids: Array<string>) => {
        const valid = ids.filter((id) => allIds.includes(id))
        return valid.length > 0 ? valid : getDefaultVisibleIds(capability)
      },
    )
  })

  const [selectedIds, setSelectedIds] = useState<Array<string>>(() => {
    return readStorage(
      storageKey(capability, 'selected'),
      [getDefaultSelectedId(capability)],
      (ids: Array<string>) => {
        const valid = ids.filter((id) => allIds.includes(id))
        return valid.length > 0 ? valid : [getDefaultSelectedId(capability)]
      },
    )
  })

  const [gensPerModel, setGensPerModel] = useState<number>(() => {
    return readStorage(storageKey(capability, 'gens'), 1)
  })

  // Persist
  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'visible'),
      JSON.stringify(visibleIds),
    )
  }, [capability, visibleIds])

  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'selected'),
      JSON.stringify(selectedIds),
    )
  }, [capability, selectedIds])

  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'gens'),
      JSON.stringify(gensPerModel),
    )
  }, [capability, gensPerModel])

  // Auto-sync: prune selected to only visible models
  useEffect(() => {
    const validSelections = selectedIds.filter((id) => visibleIds.includes(id))
    if (validSelections.length === 0 && visibleIds.length > 0) {
      setSelectedIds([visibleIds[0]])
    } else if (validSelections.length !== selectedIds.length) {
      setSelectedIds(validSelections)
    }
  }, [visibleIds, selectedIds])

  const visibleModels = useMemo<Array<UnifiedModel>>(
    () => allModels.filter((m) => visibleIds.includes(m.id)),
    [allModels, visibleIds],
  )

  const toggleSelected = useCallback(
    (modelId: string) => {
      if (mode === 'single') {
        setSelectedIds([modelId])
        return
      }
      setSelectedIds((prev) => {
        if (prev.includes(modelId)) {
          if (prev.length === 1) return prev // min-1 enforcement
          return prev.filter((id) => id !== modelId)
        }
        return [...prev, modelId]
      })
    },
    [mode],
  )

  const toggleVisible = useCallback((modelId: string) => {
    setVisibleIds((prev) => {
      if (prev.includes(modelId)) {
        if (prev.length === 1) return prev // min-1
        return prev.filter((id) => id !== modelId)
      }
      return [...prev, modelId]
    })
  }, [])

  const adjustGens = useCallback((delta: number) => {
    setGensPerModel((prev) => Math.min(Math.max(prev + delta, 1), 5))
  }, [])

  // Derived: max ref images across selected edit models
  const maxRefImages = useMemo(() => {
    if (capability !== 'edit') return undefined
    const selected = allModels.filter((m) => selectedIds.includes(m.id))
    if (selected.length === 0) return 0
    return Math.min(...selected.map((m) => m.maxRefImages ?? 0))
  }, [capability, allModels, selectedIds])

  return {
    allModels,
    visibleIds,
    visibleModels,
    selectedIds,
    gensPerModel,
    maxRefImages,
    toggleSelected,
    toggleVisible,
    setVisibleIds,
    setSelectedIds,
    adjustGens,
  }
}
