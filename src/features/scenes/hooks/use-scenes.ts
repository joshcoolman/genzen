import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_SCENE_MODEL_ID,
  SCENE_CELL_COUNT,
  SCENE_STORAGE_KEY,
} from '../constants'
import { generateScenePrompts } from '../server/generate-scene-prompts.server'
import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { SceneCellState, ScenesState } from '../types'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { setGenerationParent } from '@/features/ai-images/server/set-generation-parent.server'
import {
  ALL_IMAGE_MODELS,
  LOCKED_IMAGE_MODEL_ID,
} from '@/features/ai-images/models'
import { resolveModel } from '@/lib/use-enabled-models'
import { CREDIT_COSTS } from '@/features/credits'
import { useGenerationGrid } from '@/lib/hooks/useGenerationGrid'

// ─── Cell persistence ─────────────────────────────────────────────────────────

const CELLS_KEY = 'cells'

interface PersistedCell {
  id: string
  prompt: string
  pendingId: string | null
  generations: Array<SavedAiImage>
  currentSlideIndex: number
}

function buildInitialCells(): Array<SceneCellState> {
  return Array.from({ length: SCENE_CELL_COUNT }, (_, i) => ({
    id: String(i),
    prompt: '',
    generations: [],
    currentSlideIndex: 0,
    pendingId: null,
  }))
}

function loadPersistedCells(): Array<SceneCellState> {
  if (typeof window === 'undefined') return buildInitialCells()
  try {
    const raw = localStorage.getItem(`${SCENE_STORAGE_KEY}:${CELLS_KEY}`)
    if (!raw) return buildInitialCells()
    const parsed = JSON.parse(raw) as Array<PersistedCell>
    return parsed.map((c) => {
      const gens = c.generations
      const slideIndex = Math.max(
        0,
        Math.min(c.currentSlideIndex, Math.max(0, gens.length - 1)),
      )
      return {
        id: c.id,
        prompt: c.prompt || '',
        generations: gens,
        currentSlideIndex: slideIndex,
        pendingId: c.pendingId ?? null,
      }
    })
  } catch {
    return buildInitialCells()
  }
}

function persistCells(cells: Array<SceneCellState>) {
  try {
    const data: Array<PersistedCell> = cells.map((c) => ({
      id: c.id,
      prompt: c.prompt,
      pendingId: c.pendingId,
      generations: c.generations,
      currentSlideIndex: c.currentSlideIndex,
    }))
    localStorage.setItem(
      `${SCENE_STORAGE_KEY}:${CELLS_KEY}`,
      JSON.stringify(data),
    )
  } catch {
    // ignore storage errors
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScenes(): ScenesState {
  const credits = useCredits()

  const grid = useGenerationGrid<SceneCellState>({
    storageKey: SCENE_STORAGE_KEY,
    loadCells: loadPersistedCells,
    getLightboxTitle: (cell) => cell.prompt.slice(0, 40) || `Scene ${cell.id}`,
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

  const [model, setModelRaw] = useState<ImageModel>(() => {
    const storedId = ls('model', DEFAULT_SCENE_MODEL_ID)
    const resolvedId = resolveModel(storedId, LOCKED_IMAGE_MODEL_ID)
    return (
      ALL_IMAGE_MODELS.find((m) => m.id === resolvedId) ??
      ALL_IMAGE_MODELS.find((m) => m.id === DEFAULT_SCENE_MODEL_ID) ??
      ALL_IMAGE_MODELS[0]
    )
  })
  const [aspectRatio, setAspectRatioRaw] = useState(() =>
    ls('aspect-ratio', '1:1'),
  )
  const [orientation, setOrientationRaw] = useState<'landscape' | 'portrait'>(
    () => ls('orientation', 'landscape') as 'landscape' | 'portrait',
  )
  const [textPrompt, setTextPromptRaw] = useState(() => ls('text-prompt', ''))
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false)

  const setModel = useCallback(
    (m: ImageModel) => {
      lsSet('model', m.id)
      setModelRaw(m)
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

  const setOrientation = useCallback(
    (v: 'landscape' | 'portrait') => {
      lsSet('orientation', v)
      setOrientationRaw(v)
    },
    [lsSet],
  )

  const setTextPrompt = useCallback(
    (v: string) => {
      lsSet('text-prompt', v)
      setTextPromptRaw(v)
    },
    [lsSet],
  )

  // ─── Cell prompt setter ───────────────────────────────────────────────────

  const setCellPrompt = useCallback(
    (cellId: string, prompt: string) => {
      setCells((prev) =>
        prev.map((c) => (c.id === cellId ? { ...c, prompt } : c)),
      )
    },
    [setCells],
  )

  // ─── Generate prompts ─────────────────────────────────────────────────────

  const generatePrompts = useCallback(async () => {
    if (!accessToken || isGeneratingPrompts) return
    if (!sourceImage) return

    setIsGeneratingPrompts(true)
    setError(null)

    try {
      const result = await generateScenePrompts({
        data: {
          accessToken,
          sourceImageBase64: sourceImage.base64,
          cellCount: SCENE_CELL_COUNT,
        },
      })

      setCells((prev) =>
        prev.map((c, i) => ({
          ...c,
          prompt: result.prompts[i] ?? '',
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsGeneratingPrompts(false)
    }
  }, [accessToken, sourceImage, isGeneratingPrompts, setCells, setError])

  // ─── Regenerate single cell prompt ───────────────────────────────────────

  const regenerateCellPrompt = useCallback(
    async (cellId: string) => {
      if (!accessToken || isGeneratingPrompts) return
      if (!sourceImage) return

      setIsGeneratingPrompts(true)
      setError(null)

      try {
        const result = await generateScenePrompts({
          data: {
            accessToken,
            sourceImageBase64: sourceImage.base64,
            cellCount: 1,
          },
        })

        const newPrompt = result.prompts[0] ?? ''
        setCells((prev) =>
          prev.map((c) => (c.id === cellId ? { ...c, prompt: newPrompt } : c)),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsGeneratingPrompts(false)
      }
    },
    [accessToken, sourceImage, isGeneratingPrompts, setCells, setError],
  )

  // ─── Run single cell ──────────────────────────────────────────────────────

  const runCell = useCallback(
    async (cellId: string) => {
      if (!accessToken) return
      const cell = cells.find((c) => c.id === cellId)
      if (!cell || cell.pendingId !== null) return

      const prompt = cell.prompt.trim()
      if (!prompt) return

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
            model: model.id,
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
          title: prompt.slice(0, 60) || 'Scene generation',
          storage_path: null,
          created_at: new Date().toISOString(),
          status: 'pending',
          generation_error: null,
          generation_metadata: { prompt, model: model.id },
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
      model,
      aspectRatio,
      credits,
      setCells,
      setError,
    ],
  )

  // ─── Generate all cells ───────────────────────────────────────────────────

  const generateAll = useCallback(async () => {
    if (!accessToken || grid.isGeneratingAll) return

    const activeCells = cells.filter(
      (c) => c.prompt.trim() && c.pendingId === null,
    )
    if (activeCells.length === 0) return

    const reason = sourceImage ? 'variation' : 'image_gen'
    const cost = CREDIT_COSTS[reason] * activeCells.length
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setIsGeneratingAll(true)
    setError(null)

    const hasLibrarySource = !!sourceImage?.id

    const results = await Promise.allSettled(
      activeCells.map(async (cell) => {
        const prompt = cell.prompt.trim()
        const result = await generateImage({
          data: {
            prompt,
            model: model.id,
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
        // Set pendingId immediately — fast models (e.g. Nano Banana 2) can
        // complete and send the realtime event before this setState runs
        const pendingRecord: SavedAiImage = {
          id: result.recordId,
          title: prompt.slice(0, 60) || 'Scene generation',
          storage_path: null,
          created_at: new Date().toISOString(),
          status: 'pending',
          generation_error: null,
          generation_metadata: { prompt, model: model.id },
        }
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? {
                  ...c,
                  pendingId: result.recordId,
                  generations: [...c.generations, pendingRecord],
                }
              : c,
          ),
        )
        return { cellId: cell.id, recordId: result.recordId, prompt }
      }),
    )

    if (!hasLibrarySource) {
      const succeeded = results
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            cellId: string
            recordId: string
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

    // Immediate poll to catch fast models that completed synchronously
    try {
      await checkPendingGenerations({ data: { accessToken } })
    } catch {
      // non-fatal
    }

    await credits.refresh()
    setIsGeneratingAll(false)
  }, [
    accessToken,
    cells,
    sourceImage,
    model,
    aspectRatio,
    credits,
    grid.isGeneratingAll,
    setCells,
    setIsGeneratingAll,
    setError,
  ])

  // ─── Clear all ────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setCells(buildInitialCells())
    clearGridState(['text-prompt', 'aspect-ratio', 'orientation', 'model'])
    setTextPromptRaw('')
  }, [setCells, clearGridState])

  return {
    ...grid,
    aspectRatio,
    setAspectRatio,
    orientation,
    setOrientation,
    model,
    setModel,
    textPrompt,
    setTextPrompt,
    isGeneratingPrompts,
    generatePrompts,
    regenerateCellPrompt,
    generateAll,
    runCell,
    setCellPrompt,
    clearAll,
  }
}
