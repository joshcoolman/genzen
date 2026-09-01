'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type {
  ModelCapability,
  SelectionMode,
} from '#/features/ai-images/model-selector/types'
import {
  getDefaultSelectedId,
  getModelsByCapability,
} from '#/features/ai-images/model-selector/unified-models'
import { usePersistedState } from '#/lib/use-persisted-state'

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
   * and Images both use 'generate') keep independent persisted selections.
   */
  storageScope?: string
  /**
   * Which model a caller with no stored selection starts on. Without it the
   * default is the head of the lineup -- or of `allowedIds`, whose order is a
   * curation. Lighting needs both: the list price-sorted like every other
   * picker, and Grok Imagine selected, because that is the model its effects
   * were judged on. Pinning it to the head of `allowedIds` would have made the
   * one thing the column exists to show -- the cheap tier as a visible band --
   * a lie in exactly one dialog.
   */
  defaultId?: string
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
  defaultId: defaultIdOverride,
}: UseModelSelectorOptions) {
  const allModels = useMemo(() => {
    const base = getModelsByCapability(capability)
    if (!allowedIds) return base
    // Restrict to the curated allowlist, preserving allowlist order.
    return allowedIds
      .map((id) => base.find((m) => m.id === id))
      .filter((m): m is (typeof base)[number] => !!m)
  }, [capability, allowedIds])
  // The lineup is the offer: what is in IMAGE_MODELS is what a selector shows.
  // There is no per-user hiding to subtract, which is why this is not a filter.
  const models = allModels
  const modelIds = useMemo(() => models.map((m) => m.id), [models])

  const defaultId =
    defaultIdOverride ??
    (allowedIds && allModels[0]
      ? allModels[0].id
      : getDefaultSelectedId(capability))

  const [selectedIds, setSelectedIds, selectedHydrated] = usePersistedState<
    Array<string>
  >(
    () =>
      readStorage(
        storageKey(capability, 'selected', storageScope),
        [defaultId],
        (ids: Array<string>) => {
          const valid = ids.filter((id) => modelIds.includes(id))
          return valid.length > 0 ? valid : [defaultId]
        },
      ),
    [defaultId],
  )

  const [gensPerModel, setGensPerModel, gensHydrated] =
    usePersistedState<number>(
      () => readStorage(storageKey(capability, 'gens'), 1),
      1,
    )

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

  // Persist selected models. Gated on hydration -- see usePersistedState.
  useEffect(() => {
    if (!selectedHydrated) return
    localStorage.setItem(
      storageKey(capability, 'selected', storageScope),
      JSON.stringify(selectedIds),
    )
  }, [capability, storageScope, selectedIds, selectedHydrated])

  // Persist gens per model
  useEffect(() => {
    if (!gensHydrated) return
    localStorage.setItem(
      storageKey(capability, 'gens', storageScope),
      JSON.stringify(gensPerModel),
    )
  }, [capability, storageScope, gensPerModel, gensHydrated])

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

  /**
   * The picker header's tick: everything, or nothing (#358).
   *
   * Multi only -- a single-selection picker has no "all" to mean. It ignores
   * the min-1 rule that `toggleSelected` keeps, and deliberately: that rule
   * stops a row-click from quietly leaving you unable to generate, while this
   * control says "none" out loud and is one click to undo. Zero is a state the
   * generator already handles -- `canGenerate` requires a model -- so the
   * Generate button simply goes dead, which is the honest answer to picking
   * nothing.
   */
  const toggleAll = useCallback(() => {
    if (mode === 'single') return
    setSelectedIds((prev) => (prev.length === modelIds.length ? [] : modelIds))
  }, [mode, modelIds])

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
    toggleAll,
    adjustGens,
    selectOnly,
  }
}
