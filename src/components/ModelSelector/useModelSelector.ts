'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDefaultSelectedId, getModelsByCapability } from './models'
import type { ModelCapability, SelectionMode } from './types'
import { useEnabledModels } from '@/lib/use-enabled-models'

interface UseModelSelectorOptions {
  capability: ModelCapability
  mode: SelectionMode
  /**
   * Optional curated allowlist of model ids. When provided, only these models
   * are surfaced (preserving the given order) and the default selection is the
   * first allowed model. Used by Canvas to restrict to image-input models.
   */
  allowedIds?: Array<string>
  /**
   * Optional storage namespace so callers sharing a `capability` (e.g. Canvas
   * and AI Images both use 'generate') keep independent persisted selections.
   */
  storageScope?: string
}

function storageKey(
  capability: ModelCapability,
  suffix: string,
  scope?: string,
) {
  return `genzen:model-selector:${capability}${scope ? `:${scope}` : ''}:${suffix}`
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
  allowedIds,
  storageScope,
}: UseModelSelectorOptions) {
  const { isModelEnabled } = useEnabledModels()
  const allModels = useMemo(() => {
    const base = getModelsByCapability(capability)
    if (!allowedIds) return base
    // Restrict to the curated allowlist, preserving allowlist order.
    return allowedIds
      .map((id) => base.find((m) => m.id === id))
      .filter((m): m is (typeof base)[number] => !!m)
  }, [capability, allowedIds])
  const models = useMemo(
    () => allModels.filter((m) => isModelEnabled(m.id)),
    [allModels, isModelEnabled],
  )
  const modelIds = useMemo(() => models.map((m) => m.id), [models])

  const defaultId =
    allowedIds && allModels[0]
      ? allModels[0].id
      : getDefaultSelectedId(capability)

  const [selectedIds, setSelectedIds] = useState<Array<string>>(() => {
    return readStorage(
      storageKey(capability, 'selected', storageScope),
      [defaultId],
      (ids: Array<string>) => {
        const valid = ids.filter((id) => modelIds.includes(id))
        return valid.length > 0 ? valid : [defaultId]
      },
    )
  })

  const [gensPerModel, setGensPerModel] = useState<number>(() => {
    return readStorage(storageKey(capability, 'gens'), 1)
  })

  // Keep the selection within the currently-available models. When `allowedIds`
  // narrows (e.g. canvas scopes models to those that fit the selected group),
  // drop now-invalid ids and fall back to the default if none remain.
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => modelIds.includes(id))
      if (valid.length === prev.length) return prev
      return valid.length > 0 ? valid : [defaultId]
    })
  }, [modelIds, defaultId])

  // Persist selected models
  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'selected', storageScope),
      JSON.stringify(selectedIds),
    )
  }, [capability, storageScope, selectedIds])

  // Persist gens per model
  useEffect(() => {
    localStorage.setItem(
      storageKey(capability, 'gens', storageScope),
      JSON.stringify(gensPerModel),
    )
  }, [capability, storageScope, gensPerModel])

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

  const selectOnly = useCallback(
    (ids: Array<string>) => {
      const valid = ids.filter((id) => modelIds.includes(id))
      if (valid.length > 0) setSelectedIds(valid)
    },
    [modelIds],
  )

  // Derived: max ref images across selected models (edit + sidebar)
  const maxRefImages = useMemo(() => {
    if (capability !== 'edit' && capability !== 'sidebar') return undefined
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
    selectOnly,
  }
}
