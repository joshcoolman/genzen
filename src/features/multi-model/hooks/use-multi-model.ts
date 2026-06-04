import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_COMPARE_MODEL_IDS,
  KONTEXT_DEV,
  KONTEXT_DEV_FALLBACK,
  MULTI_MODEL_STORAGE_KEY,
} from '../constants'
import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { ModelCellState, MultiModelState } from '../types'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { setGenerationParent } from '@/features/ai-images/server/set-generation-parent.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { CREDIT_COSTS } from '@/features/credits'
import { useGenerationGrid } from '@/lib/hooks/useGenerationGrid'

// ─── Cell persistence ─────────────────────────────────────────────────────────

const CELLS_KEY = 'cells'

interface PersistedCell {
  id: string
  modelId: string
  isEnabled: boolean
  generations: Array<SavedAiImage>
  currentSlideIndex: number
}

function buildInitialCells(): Array<ModelCellState> {
  return DEFAULT_COMPARE_MODEL_IDS.map((modelId, i) => ({
    id: String(i),
    model:
      ALL_IMAGE_MODELS.find((m) => m.id === modelId) ?? ALL_IMAGE_MODELS[0],
    isEnabled: true,
    generations: [],
    currentSlideIndex: 0,
    pendingId: null,
  }))
}

function loadPersistedCells(): Array<ModelCellState> {
  if (typeof window === 'undefined') return buildInitialCells()
  try {
    const raw = localStorage.getItem(`${MULTI_MODEL_STORAGE_KEY}:${CELLS_KEY}`)
    if (!raw) return buildInitialCells()
    const parsed = JSON.parse(raw) as Array<PersistedCell>
    return parsed.map((c) => {
      const gens = c.generations.filter((g) => g.status !== 'pending')
      const slideIndex = Math.max(
        0,
        Math.min(c.currentSlideIndex, gens.length - 1),
      )
      return {
        id: c.id,
        model:
          ALL_IMAGE_MODELS.find((m) => m.id === c.modelId) ??
          ALL_IMAGE_MODELS[0],
        isEnabled: c.isEnabled,
        generations: gens,
        currentSlideIndex: slideIndex,
        pendingId: null,
      }
    })
  } catch {
    return buildInitialCells()
  }
}

function persistCells(cells: Array<ModelCellState>) {
  try {
    const data: Array<PersistedCell> = cells.map((c) => ({
      id: c.id,
      modelId: c.model.id,
      isEnabled: c.isEnabled,
      generations: c.generations.filter((g) => g.status !== 'pending'),
      currentSlideIndex: c.currentSlideIndex,
    }))
    localStorage.setItem(
      `${MULTI_MODEL_STORAGE_KEY}:${CELLS_KEY}`,
      JSON.stringify(data),
    )
  } catch {
    // ignore storage errors
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiModel(): MultiModelState {
  const credits = useCredits()

  const grid = useGenerationGrid<ModelCellState>({
    storageKey: MULTI_MODEL_STORAGE_KEY,
    loadCells: loadPersistedCells,
    getLightboxTitle: (cell) => cell.model.name,
  })

  const {
    cells,
    setCells,
    sourceImage,
    accessToken,
    clearGridState,
    ls,
    lsSet,
    setError,
    setIsGeneratingAll,
  } = grid

  // ─── Persist cells whenever they change ──────────────────────────────────

  useEffect(() => {
    persistCells(cells)
  }, [cells])

  // ─── Persisted settings ───────────────────────────────────────────────────

  const [systemPrompt, setSystemPromptRaw] = useState(() =>
    ls('system-prompt', ''),
  )
  const [userPrompt, setUserPromptRaw] = useState(() => ls('user-prompt', ''))
  const [aspectRatio, setAspectRatioRaw] = useState(() =>
    ls('aspect-ratio', '1:1'),
  )
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    () => ls('orientation', 'landscape') as 'landscape' | 'portrait',
  )

  const setSystemPrompt = useCallback(
    (v: string) => {
      lsSet('system-prompt', v)
      setSystemPromptRaw(v)
    },
    [lsSet],
  )

  const setUserPrompt = useCallback(
    (v: string) => {
      lsSet('user-prompt', v)
      setUserPromptRaw(v)
    },
    [lsSet],
  )

  const setAspectRatio = useCallback(
    (v: string) => {
      lsSet('aspect-ratio', v)
      setAspectRatioRaw(v)
    },
    [lsSet],
  )

  const setOrientationPersisted = useCallback(
    (v: 'landscape' | 'portrait') => {
      lsSet('orientation', v)
      setOrientation(v)
    },
    [lsSet],
  )

  // ─── Prompt builder ───────────────────────────────────────────────────────

  function buildPrompt(): string {
    const sys = systemPrompt.trim()
    const usr = userPrompt.trim()
    if (sys && usr) return `${sys}\n\n${usr}`
    return sys || usr
  }

  // ─── Cell controls ────────────────────────────────────────────────────────

  const toggleCell = useCallback(
    (cellId: string) => {
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId ? { ...c, isEnabled: !c.isEnabled } : c,
        ),
      )
    },
    [setCells],
  )

  const setCellModel = useCallback(
    (cellId: string, model: ImageModel) => {
      setCells((prev) =>
        prev.map((c) => (c.id === cellId ? { ...c, model } : c)),
      )
    },
    [setCells],
  )

  // ─── Run single cell ──────────────────────────────────────────────────────

  const runCell = useCallback(
    async (cellId: string) => {
      if (!accessToken) return
      const cell = cells.find((c) => c.id === cellId)
      if (!cell || !cell.isEnabled || cell.pendingId !== null) return

      const prompt = buildPrompt()
      if (!prompt && !sourceImage) return

      let modelId = cell.model.id
      if (modelId === KONTEXT_DEV && !sourceImage)
        modelId = KONTEXT_DEV_FALLBACK

      const reason = sourceImage ? 'variation' : 'image_gen'
      const cost = CREDIT_COSTS[reason]
      if (credits.balance !== null && credits.balance < cost) {
        credits.showInsufficientCredits(cost)
        return
      }

      try {
        const result = await generateImage({
          data: {
            prompt,
            model: modelId,
            accessToken,
            aspectRatio,
            ...(sourceImage
              ? sourceImage.base64.startsWith('data:')
                ? { sourceImageBase64: sourceImage.base64 }
                : { sourceImageUrl: sourceImage.base64 }
              : {}),
            ...(sourceImage?.id ? { parentImageId: sourceImage.id } : {}),
          },
        })

        const pendingRecord: SavedAiImage = {
          id: result.recordId,
          title: prompt.slice(0, 60) || 'Multi-model generation',
          storage_path: null,
          created_at: new Date().toISOString(),
          status: 'pending',
          generation_error: null,
          generation_metadata: { prompt, model: modelId },
        }

        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  pendingId: result.recordId,
                  generations: [...c.generations, pendingRecord],
                }
              : c,
          ),
        )
        await credits.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Insufficient credits')) {
          credits.showInsufficientCredits(CREDIT_COSTS[reason])
        } else {
          setError(msg)
        }
      }
    },
    [
      accessToken,
      cells,
      sourceImage,
      aspectRatio,
      systemPrompt,
      userPrompt,
      credits,
      setError,
      setCells,
    ],
  )

  // ─── Generate all enabled cells ───────────────────────────────────────────

  const generateAll = useCallback(async () => {
    if (!accessToken || grid.isGeneratingAll) return
    const prompt = buildPrompt()
    if (!prompt && !sourceImage) return

    const enabledCells = cells.filter(
      (c) => c.isEnabled && c.pendingId === null,
    )
    if (enabledCells.length === 0) return

    const reason = sourceImage ? 'variation' : 'image_gen'
    const cost = CREDIT_COSTS[reason] * enabledCells.length
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setIsGeneratingAll(true)
    setError(null)

    const hasLibrarySource = !!sourceImage?.id

    const results = await Promise.allSettled(
      enabledCells.map(async (cell) => {
        let modelId = cell.model.id
        if (modelId === KONTEXT_DEV && !sourceImage)
          modelId = KONTEXT_DEV_FALLBACK

        const result = await generateImage({
          data: {
            prompt,
            model: modelId,
            accessToken,
            aspectRatio,
            ...(sourceImage
              ? sourceImage.base64.startsWith('data:')
                ? { sourceImageBase64: sourceImage.base64 }
                : { sourceImageUrl: sourceImage.base64 }
              : {}),
            ...(hasLibrarySource ? { parentImageId: sourceImage.id } : {}),
          },
        })
        return { cellId: cell.id, recordId: result.recordId, modelId, prompt }
      }),
    )

    setCells((prev) => {
      let next = [...prev]
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { cellId, recordId, modelId, prompt: p } = r.value
          const pendingRecord: SavedAiImage = {
            id: recordId,
            title: p.slice(0, 60) || 'Multi-model generation',
            storage_path: null,
            created_at: new Date().toISOString(),
            status: 'pending',
            generation_error: null,
            generation_metadata: { prompt: p, model: modelId },
          }
          next = next.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  pendingId: recordId,
                  generations: [...c.generations, pendingRecord],
                }
              : c,
          )
        }
      }
      return next
    })

    if (!hasLibrarySource) {
      const succeeded = results
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            cellId: string
            recordId: string
            modelId: string
            prompt: string
          }> => r.status === 'fulfilled',
        )
        .map((r) => r.value.recordId)

      if (succeeded.length >= 2) {
        const [parentId, ...rest] = succeeded
        try {
          await setGenerationParent({
            data: { imageIds: rest, parentId, accessToken },
          })
        } catch {
          // non-fatal
        }
      }
    }

    const firstError = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )
    if (firstError) {
      const msg =
        firstError.reason instanceof Error
          ? firstError.reason.message
          : String(firstError.reason)
      if (msg.includes('Insufficient credits')) {
        credits.showInsufficientCredits(cost)
      } else {
        setError(msg)
      }
    }

    await credits.refresh()
    setIsGeneratingAll(false)
  }, [
    accessToken,
    cells,
    sourceImage,
    aspectRatio,
    systemPrompt,
    userPrompt,
    credits,
    grid.isGeneratingAll,
    setCells,
    setIsGeneratingAll,
    setError,
  ])

  // ─── Clear all ────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setCells(buildInitialCells())
    clearGridState(['system-prompt', 'user-prompt'])
    setSystemPromptRaw('')
    setUserPromptRaw('')
  }, [setCells, clearGridState])

  const enabledCount = cells.filter((c) => c.isEnabled).length

  return {
    ...grid,
    aspectRatio,
    setAspectRatio,
    orientation,
    setOrientation: setOrientationPersisted,
    systemPrompt,
    setSystemPrompt,
    userPrompt,
    setUserPrompt,
    generateAll,
    runCell,
    toggleCell,
    setCellModel,
    enabledCount,
    clearAll,
  }
}
