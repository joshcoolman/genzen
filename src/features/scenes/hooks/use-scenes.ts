import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SCENE_MODEL_ID,
  SCENE_CELL_COUNT,
  SCENE_STORAGE_KEY,
} from '../constants'
import { generateScenePrompts } from '../server/generate-scene-prompts.server'
import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { LibraryImage, SceneCellState, ScenesState } from '../types'
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
import { fetchImageAsBase64 } from '@/lib/server/fetch-image-base64.server'

// ─── localStorage helpers ────────────────────────────────────────────────────

function ls(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(`${SCENE_STORAGE_KEY}:${key}`) ?? fallback
}

function lsSet(key: string, value: string) {
  localStorage.setItem(`${SCENE_STORAGE_KEY}:${key}`, value)
}

function lsDel(key: string) {
  localStorage.removeItem(`${SCENE_STORAGE_KEY}:${key}`)
}

const CELLS_KEY = 'cells'

// ─── Cell state persistence ───────────────────────────────────────────────────

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

export function useScenes(): ScenesState {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const userId = session?.user.id
  const credits = useCredits()

  const [cells, setCells] = useState<Array<SceneCellState>>(loadPersistedCells)
  const [model, setModelRaw] = useState<ImageModel>(() => {
    const storedId = ls('model', DEFAULT_SCENE_MODEL_ID)
    return (
      ALL_IMAGE_MODELS.find((m) => m.id === storedId) ??
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
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
    id?: string
  } | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false)
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
  const hasPendingOnMount = useRef(cells.some((c) => c.pendingId !== null))

  useEffect(() => {
    if (!hasPendingOnMount.current || !accessToken) return
    void checkPendingGenerations({ data: { accessToken } })
  }, [accessToken]) // fires once when accessToken becomes available

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
  const setModel = useCallback((m: ImageModel) => {
    lsSet('model', m.id)
    setModelRaw(m)
  }, [])

  const setAspectRatio = useCallback((v: string) => {
    lsSet('aspect-ratio', v)
    setAspectRatioRaw(v)
  }, [])

  const setOrientation = useCallback((v: 'landscape' | 'portrait') => {
    lsSet('orientation', v)
    setOrientationRaw(v)
  }, [])

  const setTextPrompt = useCallback((v: string) => {
    lsSet('text-prompt', v)
    setTextPromptRaw(v)
  }, [])

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
    async (url: string, name: string, id?: string) => {
      if (!accessToken) return
      try {
        const { base64 } = await fetchImageAsBase64({
          data: { url, accessToken },
        })
        applySourceBase64(base64, name, id)
      } catch (err) {
        console.error('Failed to load image from library:', err)
      }
    },
    [accessToken, applySourceBase64],
  )

  const clearSourceImage = useCallback(() => {
    setSourceImage(null)
    lsDel('source-image-id')
    lsDel('source-image-name')
  }, [])

  // ─── Cell prompt setter ───────────────────────────────────────────────────────
  const setCellPrompt = useCallback((cellId: string, prompt: string) => {
    setCells((prev) =>
      prev.map((c) => (c.id === cellId ? { ...c, prompt } : c)),
    )
  }, [])

  const setCellSlide = useCallback((cellId: string, index: number) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId ? { ...c, currentSlideIndex: index } : c,
      ),
    )
  }, [])

  // ─── Generate prompts ────────────────────────────────────────────────────────
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
  }, [accessToken, sourceImage, isGeneratingPrompts])

  // ─── Regenerate single cell prompt ───────────────────────────────────────────
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
    [accessToken, sourceImage, isGeneratingPrompts],
  )

  // ─── Run single cell ──────────────────────────────────────────────────────────
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
    [accessToken, cells, sourceImage, model, aspectRatio, credits],
  )

  // ─── Generate all cells ───────────────────────────────────────────────────────
  const generateAll = useCallback(async () => {
    if (!accessToken || isGeneratingAll) return

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
        // Update this cell immediately so the realtime handler can match it
        // (Nano Banana 2 completes synchronously — pendingId must be set before
        //  the completion event arrives on the websocket channel)
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

    // Group under first succeeded image (non-library source)
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

    // Immediate poll — catches any already-completed images whose realtime events
    // arrived before pendingId was set (e.g. Nano Banana 2 synchronous completion)
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
    isGeneratingAll,
  ])

  // ─── Clear all ───────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setCells(buildInitialCells())
    setImageUrls({})
    setSourceImage(null)
    setTextPromptRaw('')
    lsDel(CELLS_KEY)
    lsDel('source-image-id')
    lsDel('source-image-name')
    lsDel('text-prompt')
    lsDel('aspect-ratio')
    lsDel('orientation')
  }, [])

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
      .channel('scenes_user_images')
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

  // ─── Lightbox ─────────────────────────────────────────────────────────────────
  const lightboxImages = cells.flatMap((cell) =>
    cell.generations
      .filter((g) => g.status === 'completed' && imageUrls[g.id])
      .map((g) => ({
        id: g.id,
        url: imageUrls[g.id] ?? '',
        title: cell.prompt.slice(0, 40) || `Scene ${cell.id}`,
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

  return {
    cells,
    setCellPrompt,
    setCellSlide,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    orientation,
    setOrientation,
    sourceImage,
    setSourceFile,
    setSourceFromUrl,
    clearSourceImage,
    textPrompt,
    setTextPrompt,
    isGeneratingPrompts,
    generatePrompts,
    regenerateCellPrompt,
    isGeneratingAll,
    generateAll,
    runCell,
    imageUrls,
    lightboxOpen,
    lightboxIndex,
    lightboxImages,
    openLightbox,
    closeLightbox,
    lightboxNext,
    lightboxPrev,
    error,
    clearAll,
    accessToken,
    userImages,
  }
}
