import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { useAuth } from '@/lib/auth'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { fetchImageAsBase64 } from '@/lib/server/fetch-image-base64.server'
import { createImageStorage } from '@/lib/image-storage'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BaseCellState {
  id: string
  pendingId: string | null
  generations: Array<SavedAiImage>
  currentSlideIndex: number
}

export interface SourceImage {
  base64: string
  name: string
  id?: string
}

export interface LibraryImage {
  id: string
  title: string
  source: string
  storage_path: string
  [key: string]: unknown
}

export interface UseGenerationGridOptions<TCell extends BaseCellState> {
  storageKey: string
  loadCells: () => Array<TCell>
  getLightboxTitle: (cell: TCell) => string
}

export interface UseGenerationGridReturn<TCell extends BaseCellState> {
  cells: Array<TCell>
  setCells: Dispatch<SetStateAction<Array<TCell>>>
  imageUrls: Record<string, string>
  addImageUrl: (imageId: string, storagePath: string) => Promise<void>
  sourceImage: SourceImage | null
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string, id?: string) => Promise<void>
  applySourceBase64: (base64: string, name: string, id?: string) => void
  clearSourceImage: () => void
  setCellSlide: (cellId: string, index: number) => void
  isGeneratingAll: boolean
  setIsGeneratingAll: Dispatch<SetStateAction<boolean>>
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  lightboxOpen: boolean
  lightboxIndex: number
  lightboxImages: Array<{ id: string; url: string; title: string }>
  openLightbox: (cellId: string, slideIndex: number) => void
  closeLightbox: () => void
  lightboxNext: () => void
  lightboxPrev: () => void
  ls: (key: string, fallback: string) => string
  lsSet: (key: string, value: string) => void
  lsDel: (key: string) => void
  clearGridState: (extraKeys?: Array<string>) => void
  accessToken: string | null
  userId: string | undefined
  userImages: {
    images: Array<LibraryImage>
    imageUrls: Record<string, string>
    isLoading: boolean
    refresh: () => Promise<void>
  }
}

// ─── Signed URL helper ────────────────────────────────────────────────────────

async function fetchSignedUrl(storagePath: string): Promise<string | null> {
  return createImageStorage(supabase).getUrl(storagePath)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGenerationGrid<TCell extends BaseCellState>({
  storageKey,
  loadCells,
  getLightboxTitle,
}: UseGenerationGridOptions<TCell>): UseGenerationGridReturn<TCell> {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const userId = session?.user.id

  const [cells, setCells] = useState<Array<TCell>>(loadCells)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ─── localStorage helpers ─────────────────────────────────────────────────

  const ls = useCallback(
    (key: string, fallback: string): string => {
      if (typeof window === 'undefined') return fallback
      return localStorage.getItem(`${storageKey}:${key}`) ?? fallback
    },
    [storageKey],
  )

  const lsSet = useCallback(
    (key: string, value: string) => {
      localStorage.setItem(`${storageKey}:${key}`, value)
    },
    [storageKey],
  )

  const lsDel = useCallback(
    (key: string) => {
      localStorage.removeItem(`${storageKey}:${key}`)
    },
    [storageKey],
  )

  // ─── Signed URL helpers ───────────────────────────────────────────────────

  const addImageUrl = useCallback(
    async (imageId: string, storagePath: string) => {
      const url = await fetchSignedUrl(storagePath)
      if (url) setImageUrls((prev) => ({ ...prev, [imageId]: url }))
    },
    [],
  )

  // ─── Hydrate signed URLs on mount for persisted generations ──────────────

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
  }, []) // run once on mount

  // ─── Kick a pending check on mount if any cells were pending ─────────────

  const hasPendingOnMount = useRef(cells.some((c) => c.pendingId !== null))

  useEffect(() => {
    if (!hasPendingOnMount.current || !accessToken) return
    void checkPendingGenerations({ data: { accessToken } })
  }, [accessToken])

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

  // ─── Source image ─────────────────────────────────────────────────────────

  const applySourceBase64 = useCallback(
    (base64: string, name: string, id?: string) => {
      setSourceImage({ base64, name, ...(id ? { id } : {}) })
      if (id) {
        lsSet('source-image-id', id)
        lsSet('source-image-name', name)
      }
    },
    [lsSet],
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
  }, [lsDel])

  // ─── Polling ──────────────────────────────────────────────────────────────

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

  // ─── Supabase realtime ────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`generation_grid_${storageKey}_${userId}`)
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
  }, [userId, storageKey, addImageUrl])

  // ─── Cell slide control ───────────────────────────────────────────────────

  const setCellSlide = useCallback((cellId: string, index: number) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId ? { ...c, currentSlideIndex: index } : c,
      ),
    )
  }, [])

  // ─── Lightbox ─────────────────────────────────────────────────────────────

  const lightboxImages = cells.flatMap((cell) =>
    cell.generations
      .filter((g) => g.status === 'completed' && imageUrls[g.id])
      .map((g) => ({
        id: g.id,
        url: imageUrls[g.id] ?? '',
        title: getLightboxTitle(cell),
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

  // ─── Clear common grid state ──────────────────────────────────────────────

  const clearGridState = useCallback(
    (extraKeys: Array<string> = []) => {
      setImageUrls({})
      setSourceImage(null)
      lsDel('cells')
      lsDel('source-image-id')
      lsDel('source-image-name')
      for (const key of extraKeys) lsDel(key)
    },
    [lsDel],
  )

  // ─── User images library ──────────────────────────────────────────────────

  const existingImages = useExistingImages(userId)
  const userImages = {
    images: existingImages.images as Array<LibraryImage>,
    imageUrls: existingImages.imageUrls,
    isLoading: existingImages.isLoading,
    refresh: existingImages.refresh,
  }

  return {
    cells,
    setCells,
    imageUrls,
    addImageUrl,
    sourceImage,
    setSourceFile,
    setSourceFromUrl,
    applySourceBase64,
    clearSourceImage,
    setCellSlide,
    isGeneratingAll,
    setIsGeneratingAll,
    error,
    setError,
    lightboxOpen,
    lightboxIndex,
    lightboxImages,
    openLightbox,
    closeLightbox,
    lightboxNext,
    lightboxPrev,
    ls,
    lsSet,
    lsDel,
    clearGridState,
    accessToken,
    userId,
    userImages,
  }
}
