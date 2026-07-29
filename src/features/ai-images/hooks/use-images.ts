'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { retryGeneration } from '#/features/ai-images/server/retry-generation.server'
import { updateImageOrder } from '#/features/ai-images/server/update-image-order.server'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.server'
import { createImageStorage } from '#/lib/image-storage'
import {
  deleteGalleryImage,
  listGalleryImages,
} from '#/features/ai-images/server/gallery.actions'

interface UseImagesOptions {
  userId: string | undefined
}

interface RefreshOptions {
  /** Leave the existing cards on screen instead of showing the skeleton. */
  silent?: boolean
}

function sortByOrder(images: Array<SavedAiImage>): Array<SavedAiImage> {
  return [...images].sort((a, b) => {
    const aOrder = a.sort_order ?? new Date(a.created_at).getTime() / 1000
    const bOrder = b.sort_order ?? new Date(b.created_at).getTime() / 1000
    return bOrder - aOrder
  })
}

export interface GalleryState {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  loadingGallery: boolean
  deleteImage: (img: SavedAiImage) => Promise<void>
  addOptimisticCard: (card: SavedAiImage) => void
  replaceOptimisticCard: (optimisticId: string, realCard: SavedAiImage) => void
  removeOptimisticCard: (optimisticId: string) => void
  setImageUrl: (id: string, url: string) => void
  reorderImages: (draggedId: string, newSortOrder: number) => Promise<void>
  retryImage: (img: SavedAiImage) => Promise<void>
  refresh: (options?: RefreshOptions) => Promise<void>
}

export function useImages({ userId }: UseImagesOptions): GalleryState {
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loadingGallery, setLoadingGallery] = useState(true)

  const loadSavedImages = useCallback(
    async (options?: RefreshOptions) => {
      if (!userId) return

      try {
        if (!options?.silent) setLoadingGallery(true)

        const images = sortByOrder(await listGalleryImages())
        setSavedImages(images)
        setLoadingGallery(false)

        // Batch signed URL generation
        const completedWithPath = images.filter(
          (img) => img.status === 'completed' && img.storage_path,
        )
        const urlEntries = await Promise.all(
          completedWithPath.map(async (img) => {
            const path = img.thumbnail_path ?? img.storage_path!
            const url = await createImageStorage().getUrl(path)
            return url ? ([img.id, url] as const) : null
          }),
        )
        const urls: Record<string, string> = {}
        for (const entry of urlEntries) {
          if (entry) urls[entry[0]] = entry[1]
        }

        setImageUrls(urls)
      } catch {
        console.error('Failed to load saved AI images')
      } finally {
        setLoadingGallery(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    void loadSavedImages()
  }, [loadSavedImages])

  // Poll FAL for pending generations (skipped when webhooks are enabled).
  //
  // The poll is also how the gallery finds out anything changed. There used to
  // be a `postgres_changes` channel here doing that, but it went with #174:
  // `user_images` is in no publication, and the browser has had no Supabase
  // session since #171, so it had already stopped delivering anything.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (process.env.VITE_ENABLE_FAL_WEBHOOKS === 'true') return

    const hasPending = savedImages.some((img) => img.status === 'pending')

    const pollOnce = () =>
      checkPendingGenerations()
        .then((result) => {
          if (result.completed === 0 && result.failed === 0) return
          return loadSavedImages({ silent: true })
        })
        .catch(() => {})

    if (hasPending && !pollingRef.current) {
      // Initial check immediately
      void pollOnce()
      pollingRef.current = setInterval(() => {
        void pollOnce()
      }, 5000)
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [savedImages.some((img) => img.status === 'pending'), loadSavedImages])

  function addOptimisticCard(card: SavedAiImage) {
    setSavedImages((prev) => [card, ...prev])
  }

  function replaceOptimisticCard(optimisticId: string, realCard: SavedAiImage) {
    setSavedImages((prev) =>
      prev.map((i) => (i.id === optimisticId ? realCard : i)),
    )
  }

  function removeOptimisticCard(optimisticId: string) {
    setSavedImages((prev) => prev.filter((i) => i.id !== optimisticId))
  }

  function setImageUrl(id: string, url: string) {
    setImageUrls((prev) => ({ ...prev, [id]: url }))
  }

  function forgetImages(ids: Set<string>) {
    setSavedImages((prev) => prev.filter((i) => !ids.has(i.id)))
    setImageUrls((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
  }

  async function deleteImage(img: SavedAiImage) {
    if (img.storage_path) createImageStorage().invalidateUrl(img.storage_path)
    if (img.thumbnail_path)
      createImageStorage().invalidateUrl(img.thumbnail_path)
    forgetImages(new Set([img.id]))

    try {
      await deleteGalleryImage(img.id)
    } catch {
      await loadSavedImages({ silent: true })
    }
  }

  async function retryImage(img: SavedAiImage) {
    // The retry reuses this row, so the card stays where it is and goes back to
    // pending in place. Flipping it here also restarts the poll, which is what
    // carries it to its next outcome.
    setSavedImages((prev) =>
      prev.map((i) =>
        i.id === img.id
          ? { ...i, status: 'pending' as const, generation_error: null }
          : i,
      ),
    )
    try {
      await retryGeneration({ recordId: img.id })
    } catch {
      // Put the failed state back -- the retry never reached FAL.
      setSavedImages((prev) => prev.map((i) => (i.id === img.id ? img : i)))
    }
  }

  async function reorderImages(draggedId: string, newSortOrder: number) {
    const prev = savedImages
    setSavedImages((current) =>
      sortByOrder(
        current.map((img) =>
          img.id === draggedId ? { ...img, sort_order: newSortOrder } : img,
        ),
      ),
    )

    try {
      await updateImageOrder({ imageId: draggedId, sortOrder: newSortOrder })
    } catch {
      setSavedImages(prev)
    }
  }

  return {
    images: savedImages,
    imageUrls,
    loadingGallery,
    deleteImage,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    setImageUrl,
    reorderImages,
    retryImage,
    refresh: loadSavedImages,
  }
}
