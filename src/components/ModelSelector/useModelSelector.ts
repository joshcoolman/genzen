import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDefaultSelectedId, getModelsByCapability } from './models'
import type { ModelCapability, SelectionMode } from './types'

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
  const models = useMemo(() => getModelsByCapability(capability), [capability])
  const modelIds = useMemo(() => models.map((m) => m.id), [models])

  const [selectedIds, setSelectedIds] = useState<Array<string>>(() => {
    return readStorage(
      storageKey(capability, 'selected'),
      [getDefaultSelectedId(capability)],
      (ids: Array<string>) => {
        const valid = ids.filter((id) => modelIds.includes(id))
        return valid.length > 0 ? valid : [getDefaultSelectedId(capability)]
      },
    )
  })

  const [gensPerModel, setGensPerModel] = useState<number>(() => {
    return readStorage(storageKey(capability, 'gens'), 1)
  })

  // Persist selected models
  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'selected'),
      JSON.stringify(selectedIds),
    )
  }, [capability, selectedIds])

  // Persist gens per model
  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'gens'),
      JSON.stringify(gensPerModel),
    )
  }, [capability, gensPerModel])

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

  const adjustGens = useCallback((delta: number) => {
    setGensPerModel((prev) => Math.min(Math.max(prev + delta, 1), 5))
  }, [])

  // Derived: max ref images across selected edit models
  const maxRefImages = useMemo(() => {
    if (capability !== 'edit') return undefined
    const selected = models.filter((m) => selectedIds.includes(m.id))
    if (selected.length === 0) return 0
    return Math.min(...selected.map((m) => m.maxRefImages ?? 0))
  }, [capability, models, selectedIds])

  return {
    models,
    selectedIds,
    gensPerModel,
    maxRefImages,
    toggleSelected,
    adjustGens,
  }
}
