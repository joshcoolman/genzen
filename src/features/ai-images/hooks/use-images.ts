'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { retryGeneration } from '#/features/ai-images/server/retry-generation.server'
import { updateImageOrder } from '#/features/ai-images/server/update-image-order.server'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.server'
import { createImageStorage } from '#/lib/image-storage'
import { ungroupImages } from '#/features/ai-images/server/ungroup-images.server'
import {
  deleteGalleryImage,
  deleteGalleryImageDetachingChildren,
  deleteGalleryImageWithDescendants,
  listGalleryImages,
  restoreHiddenRootImage,
} from '#/features/ai-images/server/gallery.actions'

interface UseImagesOptions {
  userId: string | undefined
}

interface RefreshOptions {
  /** Leave the existing cards on screen instead of showing the skeleton. */
  silent?: boolean
}

function sortByOrder(images: Array<SavedAiImage>): Array<SavedAiImage> {
  // Map each root/parent to its newest descendant's created_at
  const newestDescendant = new Map<string, number>()
  for (const img of images) {
    const meta = img.generation_metadata
    const rootId = meta?.root_image_id ?? meta?.source_image_id
    if (rootId) {
      const t = new Date(img.created_at).getTime() / 1000
      const current = newestDescendant.get(rootId) ?? 0
      if (t > current) newestDescendant.set(rootId, t)
    }
  }

  return [...images].sort((a, b) => {
    const aOwn = a.sort_order ?? new Date(a.created_at).getTime() / 1000
    const bOwn = b.sort_order ?? new Date(b.created_at).getTime() / 1000
    const aEffective = Math.max(aOwn, newestDescendant.get(a.id) ?? 0)
    const bEffective = Math.max(bOwn, newestDescendant.get(b.id) ?? 0)
    return bEffective - aEffective
  })
}

/** Ids of `imageId` and everything grouped beneath it, walking `parent_id`. */
function collectSubtree(
  imageId: string,
  images: Array<SavedAiImage>,
): Set<string> {
  const childrenOf = new Map<string, Array<string>>()
  for (const img of images) {
    const parentId = img.generation_metadata?.parent_id
    if (!parentId) continue
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push(img.id)
    childrenOf.set(parentId, siblings)
  }

  const ids = new Set<string>([imageId])
  const queue = [imageId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const childId of childrenOf.get(current) ?? []) {
      if (ids.has(childId)) continue
      ids.add(childId)
      queue.push(childId)
    }
  }
  return ids
}

export interface GalleryState {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  rootImageMeta: Record<string, { hidden: boolean }>
  loadingGallery: boolean
  deleteImage: (img: SavedAiImage) => Promise<void>
  deleteImageWithDescendants: (img: SavedAiImage) => Promise<void>
  deleteAndDetachChildren: (img: SavedAiImage) => Promise<void>
  restoreRootImage: (rootId: string) => Promise<void>
  addOptimisticCard: (card: SavedAiImage) => void
  replaceOptimisticCard: (optimisticId: string, realCard: SavedAiImage) => void
  removeOptimisticCard: (optimisticId: string) => void
  setImageUrl: (id: string, url: string) => void
  reorderImages: (draggedId: string, newSortOrder: number) => Promise<void>
  ungroupChildren: (img: SavedAiImage) => Promise<void>
  retryImage: (img: SavedAiImage) => Promise<void>
  refresh: (options?: RefreshOptions) => Promise<void>
}

export function useImages({ userId }: UseImagesOptions): GalleryState {
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [rootImageMeta, setRootImageMeta] = useState<
    Record<string, { hidden: boolean }>
  >({})
  const [loadingGallery, setLoadingGallery] = useState(true)

  const loadSavedImages = useCallback(
    async (options?: RefreshOptions) => {
      if (!userId) return

      try {
        if (!options?.silent) setLoadingGallery(true)

        const { images: rows, rootImages } = await listGalleryImages()
        const images = sortByOrder(rows)
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

        // Source images for edits and variations, which may be hidden and so
        // absent from the list above.
        const rootUrlEntries = await Promise.all(
          rootImages.map(async (r) => {
            if (!r.storage_path) return null
            const path = r.thumbnail_path ?? r.storage_path
            const url = await createImageStorage().getUrl(path)
            return url ? ([r.id, url] as const) : null
          }),
        )
        for (const entry of rootUrlEntries) {
          if (entry) urls[entry[0]] = entry[1]
        }

        setImageUrls(urls)
        setRootImageMeta(
          Object.fromEntries(
            rootImages.map((r) => [r.id, { hidden: r.hidden }]),
          ),
        )
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
      // Hide-vs-delete, and cleaning up an orphaned hidden root, are decided
      // server-side now -- they were four browser round trips reading each
      // other's results.
      await deleteGalleryImage(img.id)
    } catch {
      await loadSavedImages({ silent: true })
    }
  }

  async function deleteImageWithDescendants(img: SavedAiImage) {
    // Remove the subtree optimistically from what's on screen; the server
    // walks it again authoritatively and returns what it actually deleted.
    forgetImages(collectSubtree(img.id, savedImages))

    try {
      const deletedIds = await deleteGalleryImageWithDescendants(img.id)
      forgetImages(new Set(deletedIds))
    } catch {
      await loadSavedImages({ silent: true })
    }
  }

  async function deleteAndDetachChildren(img: SavedAiImage) {
    // Optimistic: remove parent from view, clear parent_id on children
    setSavedImages((prev) =>
      prev
        .filter((i) => i.id !== img.id)
        .map((i) => {
          if (i.generation_metadata?.parent_id !== img.id) return i
          return {
            ...i,
            generation_metadata: {
              ...i.generation_metadata,
              parent_id: undefined,
            },
          }
        }),
    )

    try {
      await deleteGalleryImageDetachingChildren(img.id)
    } catch {
      await loadSavedImages({ silent: true })
    }
  }

  async function restoreRootImage(rootId: string) {
    try {
      await restoreHiddenRootImage(rootId)
      setRootImageMeta((prev) => {
        const next = { ...prev }
        delete next[rootId]
        return next
      })
      await loadSavedImages({ silent: true })
    } catch {
      // Leave the badge in place -- the root is still hidden.
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

  async function ungroupChildren(img: SavedAiImage) {
    // Optimistic: clear parent_id on children in local state
    setSavedImages((prev) =>
      prev.map((i) => {
        if (i.generation_metadata?.parent_id !== img.id) return i
        return {
          ...i,
          generation_metadata: {
            ...i.generation_metadata,
            parent_id: undefined,
          },
        }
      }),
    )

    // Detach all children via server function
    await ungroupImages({ parentId: img.id })
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
    rootImageMeta,
    loadingGallery,
    deleteImage,
    deleteImageWithDescendants,
    deleteAndDetachChildren,
    ungroupChildren,
    restoreRootImage,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    setImageUrl,
    reorderImages,
    retryImage,
    refresh: loadSavedImages,
  }
}
