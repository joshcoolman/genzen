import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_COMPARE_MODEL_IDS,
  KONTEXT_DEV,
  KONTEXT_DEV_FALLBACK,
  MULTI_MODEL_STORAGE_KEY,
} from '../constants'
import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { LibraryImage, ModelCellState, MultiModelState } from '../types'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { setGenerationParent } from '@/features/ai-images/server/set-generation-parent.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'
import { CREDIT_COSTS } from '@/features/credits'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'

// ─── localStorage helpers ────────────────────────────────────────────────────

function ls(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(`${MULTI_MODEL_STORAGE_KEY}:${key}`) ?? fallback
}

function lsSet(key: string, value: string) {
  localStorage.setItem(`${MULTI_MODEL_STORAGE_KEY}:${key}`, value)
}

function lsDel(key: string) {
  localStorage.removeItem(`${MULTI_MODEL_STORAGE_KEY}:${key}`)
}

const CELLS_KEY = 'cells'

// ─── Cell state persistence ───────────────────────────────────────────────────

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
    lsSet(CELLS_KEY, JSON.stringify(data))
  } catch {
    // ignore storage errors
  }
}

// ─── Signed URL helper ────────────────────────────────────────────────────────

async function fetchSignedUrl(storagePath: string): Promise<string | null> {
  return createImageStorage(supabase).getUrl(storagePath)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiModel(): MultiModelState {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const userId = session?.user.id
  const credits = useCredits()

  const [cells, setCells] = useState<Array<ModelCellState>>(loadPersistedCells)
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
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
    id?: string
  } | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Library images for the picker
  const existingImages = useExistingImages(userId)
  const userImages = {
    images: existingImages.images as Array<LibraryImage>,
    imageUrls: existingImages.imageUrls,
    isLoading: existingImages.isLoading,
    refresh: existingImages.refresh,
  }

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ─── Persist cells whenever generations change ──────────────────────────────
  useEffect(() => {
    persistCells(cells)
  }, [cells])

  // ─── Hydrate signed URLs on mount for persisted generations ─────────────────
  useEffect(() => {
    const allGens = cells.flatMap((c) => c.generations)
    const withPaths = allGens.filter(
      (g) => g.status === 'completed' && g.storage_path,
    )
    if (withPaths.length === 0) return

    void (async () => {
      const entries = await Promise.all(
        withPaths.map(async (g) => {
          const url = await fetchSignedUrl(g.storage_path!)
          return url ? ([g.id, url] as const) : null
        }),
      )
      const urls: Record<string, string> = {}
      for (const e of entries) {
        if (e) urls[e[0]] = e[1]
      }
      setImageUrls(urls)
    })()
  }, []) // run once on mount to hydrate URLs for persisted generations

  // ─── Restore library source image on mount ────────────────────────────────
  useEffect(() => {
    const storedId = ls('source-image-id', '')
    const storedName = ls('source-image-name', '')
    if (!storedId) return

    void (async () => {
      const { data } = await supabase
        .from('user_images')
        .select('storage_path')
        .eq('id', storedId)
        .single()

      if (!data?.storage_path) return

      const url = await fetchSignedUrl(data.storage_path)
      if (!url) return

      // Load via canvas to get base64 — pass id so it stays persisted
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        setSourceImage({
          base64: canvas.toDataURL('image/png'),
          name: storedName || 'Source image',
          id: storedId,
        })
      }
      img.src = url
    })()
  }, []) // run once on mount

  // ─── Setters with persistence ─────────────────────────────────────────────────
  const setSystemPrompt = useCallback((v: string) => {
    lsSet('system-prompt', v)
    setSystemPromptRaw(v)
  }, [])

  const setUserPrompt = useCallback((v: string) => {
    lsSet('user-prompt', v)
    setUserPromptRaw(v)
  }, [])

  const setAspectRatio = useCallback((v: string) => {
    lsSet('aspect-ratio', v)
    setAspectRatioRaw(v)
  }, [])

  const setOrientationPersisted = useCallback((v: 'landscape' | 'portrait') => {
    lsSet('orientation', v)
    setOrientation(v)
  }, [])

  // ─── Build final prompt ───────────────────────────────────────────────────────
  function buildPrompt(): string {
    const sys = systemPrompt.trim()
    const usr = userPrompt.trim()
    if (sys && usr) return `${sys}\n\n${usr}`
    return sys || usr
  }

  // ─── Signed URL helper ────────────────────────────────────────────────────────
  const addImageUrl = useCallback(
    async (imageId: string, storagePath: string) => {
      const url = await fetchSignedUrl(storagePath)
      if (url) setImageUrls((prev) => ({ ...prev, [imageId]: url }))
    },
    [],
  )

  // ─── Source image ─────────────────────────────────────────────────────────────
  const applySourceBase64 = useCallback(
    (base64: string, name: string, id?: string) => {
      setSourceImage({ base64, name, ...(id ? { id } : {}) })
      if (id) {
        lsSet('source-image-id', id)
        lsSet('source-image-name', name)
      }
    },
    [],
  )

  const setSourceFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        applySourceBase64(ev.target?.result as string, file.name)
      }
      reader.readAsDataURL(file)
    },
    [applySourceBase64],
  )

  const setSourceFromUrl = useCallback(
    (url: string, name: string, id?: string) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        applySourceBase64(canvas.toDataURL('image/png'), name, id)
      }
      img.src = url
    },
    [applySourceBase64],
  )

  const clearSourceImage = useCallback(() => {
    setSourceImage(null)
    lsDel('source-image-id')
    lsDel('source-image-name')
  }, [])

  // ─── Clear all generations ────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setCells(buildInitialCells())
    setImageUrls({})
    setSourceImage(null)
    setSystemPromptRaw('')
    setUserPromptRaw('')
    lsDel(CELLS_KEY)
    lsDel('source-image-id')
    lsDel('source-image-name')
    lsDel('system-prompt')
    lsDel('user-prompt')
  }, [])

  // ─── Run single cell ──────────────────────────────────────────────────────────
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
    ],
  )

  // ─── Generate all enabled cells ───────────────────────────────────────────────
  const generateAll = useCallback(async () => {
    if (!accessToken || isGeneratingAll) return
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

    // For non-library-source generations, group under the first succeeded image
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
          // non-fatal — grouping is best-effort
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
    isGeneratingAll,
  ])

  // ─── Polling ──────────────────────────────────────────────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasPending = cells.some((c) => c.pendingId !== null)

  useEffect(() => {
    if (!hasPending || !accessToken) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }
    if (pollingRef.current) return

    pollingRef.current = setInterval(async () => {
      try {
        await checkPendingGenerations({ data: { accessToken } })
      } catch {
        // non-fatal
      }
    }, 5000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [hasPending, accessToken])

  // ─── Supabase realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('multi_model_user_images')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as SavedAiImage & {
            storage_path: string | null
          }
          if (updated.status !== 'completed' && updated.status !== 'failed')
            return

          setCells((prev) =>
            prev.map((cell) => {
              if (cell.pendingId !== updated.id) return cell

              const updatedGens = cell.generations.map((g) =>
                g.id === updated.id ? (updated as SavedAiImage) : g,
              )

              if (updated.status === 'completed' && updated.storage_path) {
                void addImageUrl(updated.id, updated.storage_path)
              }

              return {
                ...cell,
                pendingId: null,
                generations: updatedGens,
                currentSlideIndex: updatedGens.length - 1,
              }
            }),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, addImageUrl])

  // ─── Cell controls ────────────────────────────────────────────────────────────
  const toggleCell = useCallback((cellId: string) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId ? { ...c, isEnabled: !c.isEnabled } : c,
      ),
    )
  }, [])

  const setCellModel = useCallback((cellId: string, model: ImageModel) => {
    setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, model } : c)))
  }, [])

  const setCellSlide = useCallback((cellId: string, index: number) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId ? { ...c, currentSlideIndex: index } : c,
      ),
    )
  }, [])

  // ─── Lightbox ─────────────────────────────────────────────────────────────────
  const lightboxImages = cells.flatMap((cell) =>
    cell.generations
      .filter((g) => g.status === 'completed' && imageUrls[g.id])
      .map((g) => ({
        id: g.id,
        url: imageUrls[g.id] ?? '',
        title: cell.model.name,
      })),
  )

  const openLightbox = useCallback(
    (cellId: string, slideIndex: number) => {
      const cell = cells.find((c) => c.id === cellId)
      if (!cell) return
      const gen = cell.generations[slideIndex] as SavedAiImage | undefined
      if (!gen || !imageUrls[gen.id]) return
      const flatIndex = lightboxImages.findIndex((img) => img.id === gen.id)
      if (flatIndex === -1) return
      setLightboxIndex(flatIndex)
      setLightboxOpen(true)
    },
    [cells, lightboxImages, imageUrls],
  )

  const closeLightbox = useCallback(() => setLightboxOpen(false), [])
  const lightboxNext = useCallback(
    () => setLightboxIndex((i) => (i + 1) % lightboxImages.length),
    [lightboxImages.length],
  )
  const lightboxPrev = useCallback(
    () =>
      setLightboxIndex(
        (i) => (i - 1 + lightboxImages.length) % lightboxImages.length,
      ),
    [lightboxImages.length],
  )

  const enabledCount = cells.filter((c) => c.isEnabled).length

  return {
    cells,
    systemPrompt,
    setSystemPrompt,
    userPrompt,
    setUserPrompt,
    aspectRatio,
    setAspectRatio,
    orientation,
    setOrientation: setOrientationPersisted,
    sourceImage,
    setSourceFile,
    setSourceFromUrl,
    clearSourceImage,
    imageUrls,
    isGeneratingAll,
    generateAll,
    runCell,
    toggleCell,
    setCellModel,
    setCellSlide,
    lightboxOpen,
    lightboxIndex,
    lightboxImages,
    openLightbox,
    closeLightbox,
    lightboxNext,
    lightboxPrev,
    enabledCount,
    error,
    clearAll,
    accessToken,
    userImages,
  }
}
