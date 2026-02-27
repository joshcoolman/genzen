import { useCallback, useEffect, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { supabase } from '@/lib/supabase'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
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

export function useImages({ userId, accessToken }: UseImagesOptions) {
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loadingGallery, setLoadingGallery] = useState(true)

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
        .order('sort_order', { ascending: false, nullsFirst: false })
        .limit(20)

      if (queryError) throw queryError

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const images = (data ?? []) as Array<SavedAiImage>
      setSavedImages(images)

      const urls: Record<string, string> = {}
      for (const img of images) {
        if (img.status === 'completed' && img.storage_path) {
          const { data: urlData } = await supabase.storage
            .from('user-images')
            .createSignedUrl(img.storage_path, 3600)
          if (urlData) urls[img.id] = urlData.signedUrl
        }
      }
      setImageUrls(urls)
    } catch {
      console.error('Failed to load saved AI images')
    } finally {
      setLoadingGallery(false)
    }
  }, [userId])

  useEffect(() => {
    loadSavedImages()
  }, [loadSavedImages])

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

  // Background polling for pending images
  useEffect(() => {
    if (!accessToken) return

    const pendingIds = savedImages
      .filter((img) => img.status === 'pending')
      .map((img) => img.id)

    if (pendingIds.length === 0) return

    const pollInterval = setInterval(async () => {
      try {
        await checkPendingImages({
          data: { accessToken, recordIds: pendingIds },
        })
      } catch (err) {
        console.error('Error polling pending images:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [savedImages, accessToken])

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
      const { error: deleteError } = await supabase
        .from('user_images')
        .delete()
        .eq('id', img.id)

      if (deleteError) throw deleteError

      await supabase.storage.from('user-images').remove([img.storage_path])
    } catch {
      loadSavedImages()
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
    loadingGallery,
    deleteImage,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    reorderImages,
  }
}
