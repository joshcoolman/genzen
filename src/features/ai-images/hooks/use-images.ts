import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { supabase } from '@/lib/supabase'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { clearStaleGenerations } from '@/features/ai-images/server/clear-stale-generations.server'
import { retryGeneration } from '@/features/ai-images/server/retry-generation.server'
import { updateImageOrder } from '@/features/ai-images/server/update-image-order.server'

interface UseImagesOptions {
  userId: string | undefined
  accessToken: string | undefined
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
  rootImageMeta: Record<string, { hidden: boolean }>
  loadingGallery: boolean
  deleteImage: (img: SavedAiImage) => Promise<void>
  restoreRootImage: (rootId: string) => Promise<void>
  addOptimisticCard: (card: SavedAiImage) => void
  replaceOptimisticCard: (optimisticId: string, realCard: SavedAiImage) => void
  removeOptimisticCard: (optimisticId: string) => void
  reorderImages: (draggedId: string, newSortOrder: number) => Promise<void>
  clearStaleImages: () => Promise<number>
  retryImage: (img: SavedAiImage) => Promise<void>
  refresh: () => Promise<void>
}

export function useImages({
  userId,
  accessToken,
}: UseImagesOptions): GalleryState {
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [rootImageMeta, setRootImageMeta] = useState<
    Record<string, { hidden: boolean }>
  >({})
  const [loadingGallery, setLoadingGallery] = useState(true)

  // Ref so the polling interval can read current images without being a dep
  const savedImagesRef = useRef(savedImages)
  useEffect(() => {
    savedImagesRef.current = savedImages
  }, [savedImages])

  const loadSavedImages = useCallback(async () => {
    if (!userId) return

    try {
      setLoadingGallery(true)
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select(
          'id, title, storage_path, created_at, sort_order, status, generation_error, generation_metadata',
        )
        .eq('user_id', userId)
        .eq('source', 'ai_generated')
        .is('deleted_at', null)
        .eq('hidden', false)
        .order('sort_order', { ascending: false, nullsFirst: false })

      if (queryError) throw queryError

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const allImages = (data ?? []) as Array<SavedAiImage>
      // Exclude images that belong to feature-specific galleries
      const FEATURE_TYPES = new Set(['edit', 'outpaint', 'combine', 'describe'])
      const images = allImages.filter((img) => {
        const genType = img.generation_metadata?.generation_type
        return !genType || !FEATURE_TYPES.has(genType)
      })
      setSavedImages(images)

      // Batch signed URL generation
      const completedWithPath = images.filter(
        (img) => img.status === 'completed' && img.storage_path,
      )
      const urlEntries = await Promise.all(
        completedWithPath.map(async (img) => {
          const { data: urlData } = await supabase.storage
            .from('user-images')
            .createSignedUrl(img.storage_path!, 3600)
          return urlData ? ([img.id, urlData.signedUrl] as const) : null
        }),
      )
      const urls: Record<string, string> = {}
      for (const entry of urlEntries) {
        if (entry) urls[entry[0]] = entry[1]
      }
      setImageUrls(urls)

      // Fetch root image URLs for variations (including hidden roots)
      const rootIds = new Set<string>()
      for (const img of images) {
        const meta = img.generation_metadata
        if (meta?.generation_type === 'variation') {
          const rootId = meta.root_image_id ?? meta.source_image_id
          if (rootId && !urls[rootId]) rootIds.add(rootId)
        }
      }
      if (rootIds.size > 0) {
        const { data: rootRows } = await supabase
          .from('user_images')
          .select('id, storage_path, hidden')
          .in('id', Array.from(rootIds))
          .is('deleted_at', null)
        if (rootRows) {
          const meta: Record<string, { hidden: boolean }> = {}
          const rootUrlEntries = await Promise.all(
            rootRows
              .filter((r) => r.storage_path)
              .map(async (r) => {
                const { data: urlData } = await supabase.storage
                  .from('user-images')
                  .createSignedUrl(r.storage_path, 3600)
                return urlData ? ([r.id, urlData.signedUrl] as const) : null
              }),
          )
          for (const r of rootRows) {
            meta[r.id] = { hidden: !!r.hidden }
          }
          const rootUrls: Record<string, string> = {}
          for (const entry of rootUrlEntries) {
            if (entry) rootUrls[entry[0]] = entry[1]
          }
          setImageUrls((prev) => ({ ...prev, ...rootUrls }))
          setRootImageMeta(meta)
        }
      }
    } catch {
      console.error('Failed to load saved AI images')
    } finally {
      setLoadingGallery(false)
    }
  }, [userId])

  useEffect(() => {
    loadSavedImages().then(() => {
      // Auto-clear stale pending/processing images on page load
      if (accessToken) {
        clearStaleGenerations({ data: { accessToken } }).catch(() => {})
      }
    })
  }, [loadSavedImages, accessToken])

  // Realtime subscription for user_images table
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('user_images_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newImage = payload.new as SavedAiImage
            // Skip images that belong to feature-specific galleries
            const FEATURE_TYPES = new Set([
              'edit',
              'outpaint',
              'combine',
              'describe',
            ])
            const insertGenType = newImage.generation_metadata?.generation_type
            if (insertGenType && FEATURE_TYPES.has(insertGenType)) return

            setSavedImages((prev) => {
              if (prev.some((img) => img.id === newImage.id)) return prev
              const metadata = newImage.generation_metadata
              if (
                metadata?.generation_type === 'variation' &&
                metadata.source_image_id
              ) {
                const sourceId = metadata.source_image_id
                const optimisticIdx = prev.findIndex((img) =>
                  img.id.startsWith(`optimistic-${sourceId}-`),
                )
                if (optimisticIdx !== -1) {
                  const updated = [...prev]
                  updated[optimisticIdx] = newImage
                  return sortByOrder(updated)
                }
              }
              return sortByOrder([...prev, newImage])
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedImage = payload.new as SavedAiImage
            const rawUpdate = payload.new as Record<string, unknown>
            if (updatedImage.deleted_at || rawUpdate.hidden === true) {
              setSavedImages((prev) =>
                prev.filter((img) => img.id !== updatedImage.id),
              )
              setImageUrls((prev) => {
                const next = { ...prev }
                delete next[updatedImage.id]
                return next
              })
              return
            }
            setSavedImages((prev) =>
              prev.map((img) =>
                img.id === updatedImage.id ? updatedImage : img,
              ),
            )

            if (
              updatedImage.status === 'completed' &&
              updatedImage.storage_path
            ) {
              supabase.storage
                .from('user-images')
                .createSignedUrl(updatedImage.storage_path, 3600)
                .then(({ data }) => {
                  if (data) {
                    setImageUrls((prev) => ({
                      ...prev,
                      [updatedImage.id]: data.signedUrl,
                    }))
                  }
                })
                .catch(() => {
                  // Signed URL fetch failed — image will show on next full reload
                })
            }
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setSavedImages((prev) => prev.filter((img) => img.id !== deletedId))
            setImageUrls((prev) => {
              const next = { ...prev }
              delete next[deletedId]
              return next
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Background polling for pending images — uses a ref so the interval doesn't
  // reset every time savedImages changes (which would delay the first poll)
  useEffect(() => {
    if (!accessToken) return

    const pollInterval = setInterval(async () => {
      const pendingIds = savedImagesRef.current
        .filter((img) => img.status === 'pending')
        .map((img) => img.id)

      if (pendingIds.length === 0) return

      try {
        await checkPendingImages({
          data: { accessToken, recordIds: pendingIds },
        })
      } catch (err) {
        console.error('Error polling pending images:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [accessToken])

  function addOptimisticCard(card: SavedAiImage) {
    setSavedImages((prev) => sortByOrder([...prev, card]))
  }

  function replaceOptimisticCard(optimisticId: string, realCard: SavedAiImage) {
    setSavedImages((prev) => {
      const filtered = prev.filter(
        (i) => i.id !== optimisticId && i.id !== realCard.id,
      )
      return sortByOrder([...filtered, realCard])
    })
  }

  function removeOptimisticCard(optimisticId: string) {
    setSavedImages((prev) => prev.filter((i) => i.id !== optimisticId))
  }

  async function deleteImage(img: SavedAiImage) {
    setSavedImages((prev) => prev.filter((i) => i.id !== img.id))

    try {
      // Check if this image has living variations (is a root/source)
      const { count: variationCount } = await supabase
        .from('user_images')
        .select('id', { count: 'exact', head: true })
        .or(
          `generation_metadata->>root_image_id.eq.${img.id},generation_metadata->>source_image_id.eq.${img.id}`,
        )
        .is('deleted_at', null)
        .eq('hidden', false)

      if (variationCount && variationCount > 0) {
        // Hide instead of soft-delete — variations still need this image
        const { error: hideError } = await supabase
          .from('user_images')
          .update({ hidden: true })
          .eq('id', img.id)
        if (hideError) throw hideError
      } else {
        // Normal soft delete
        const { error: deleteError } = await supabase
          .from('user_images')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', img.id)
        if (deleteError) throw deleteError
      }

      // If this image is a variation, check if its root should be cleaned up
      const metadata = img.generation_metadata
      if (metadata?.generation_type === 'variation') {
        const rootId = metadata.root_image_id ?? metadata.source_image_id
        if (rootId) {
          await cleanupHiddenRoot(rootId, img.id)
        }
      }
    } catch {
      loadSavedImages()
    }
  }

  async function cleanupHiddenRoot(rootId: string, excludeId: string) {
    // Check if root is hidden
    const { data: rootImage } = await supabase
      .from('user_images')
      .select('id, storage_path, hidden')
      .eq('id', rootId)
      .single()

    if (!rootImage?.hidden) return

    // Check for other living variations
    const { count } = await supabase
      .from('user_images')
      .select('id', { count: 'exact', head: true })
      .or(
        `generation_metadata->>root_image_id.eq.${rootId},generation_metadata->>source_image_id.eq.${rootId}`,
      )
      .is('deleted_at', null)
      .neq('id', excludeId)

    if (count === 0) {
      // No more living variations — permanently delete the hidden root
      await supabase.from('user_images').delete().eq('id', rootId)
      if (rootImage.storage_path) {
        await supabase.storage
          .from('user-images')
          .remove([rootImage.storage_path])
      }
    }
  }

  async function restoreRootImage(rootId: string) {
    const { error } = await supabase
      .from('user_images')
      .update({ hidden: false })
      .eq('id', rootId)
    if (!error) {
      setRootImageMeta((prev) => {
        const next = { ...prev }
        delete next[rootId]
        return next
      })
    }
  }

  async function clearStaleImages(): Promise<number> {
    if (!accessToken) return 0
    const { cleared } = await clearStaleGenerations({ data: { accessToken } })
    return cleared
  }

  async function retryImage(img: SavedAiImage) {
    if (!accessToken) return
    // Optimistically remove the failed card — the new pending record will appear via realtime
    setSavedImages((prev) => prev.filter((i) => i.id !== img.id))
    try {
      await retryGeneration({ data: { accessToken, recordId: img.id } })
    } catch {
      // If retry fails, restore the failed card
      setSavedImages((prev) => sortByOrder([...prev, img]))
    }
  }

  async function reorderImages(draggedId: string, newSortOrder: number) {
    if (!accessToken) return

    const prev = savedImages
    setSavedImages((current) =>
      sortByOrder(
        current.map((img) =>
          img.id === draggedId ? { ...img, sort_order: newSortOrder } : img,
        ),
      ),
    )

    try {
      await updateImageOrder({
        data: { accessToken, imageId: draggedId, sortOrder: newSortOrder },
      })
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
    restoreRootImage,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    reorderImages,
    clearStaleImages,
    retryImage,
    refresh: loadSavedImages,
  }
}
