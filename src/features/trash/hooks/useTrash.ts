import { useCallback, useEffect, useState } from 'react'
import type { UserImage } from '@/features/user-images/types'
import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'user-images'

interface UseTrashReturn {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  restore: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
}

export function useTrash(userId: string | undefined): UseTrashReturn {
  const [images, setImages] = useState<Array<UserImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  const fetchTrashed = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('user_images')
        .select('*')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .eq('hidden', false)
        .in('source', ['upload', 'ai_generated'])
        .order('deleted_at', { ascending: false })

      if (error) throw error

      setImages(data)

      // Sign URLs in background
      for (const image of data) {
        supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(image.storage_path, 3600)
          .then(({ data: urlData }) => {
            if (urlData) {
              setImageUrls((prev) => ({
                ...prev,
                [image.id]: urlData.signedUrl,
              }))
            }
          })
          .catch(() => {})
      }
    } catch {
      console.error('Failed to load trashed images')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchTrashed()
  }, [fetchTrashed])

  // Realtime subscription for trash changes
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('trash_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as UserImage
            const rawUpdate = payload.new as Record<string, unknown>
            if (rawUpdate.hidden === true) {
              // Hidden images should not appear in trash
              setImages((prev) => prev.filter((img) => img.id !== updated.id))
              return
            }
            if (updated.deleted_at) {
              // Item was trashed — add to list if not already present
              setImages((prev) => {
                if (prev.some((img) => img.id === updated.id)) {
                  return prev.map((img) =>
                    img.id === updated.id ? updated : img,
                  )
                }
                return [updated, ...prev]
              })
              // Sign URL
              supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(updated.storage_path, 3600)
                .then(({ data }) => {
                  if (data) {
                    setImageUrls((prev) => ({
                      ...prev,
                      [updated.id]: data.signedUrl,
                    }))
                  }
                })
                .catch(() => {})
            } else {
              // Item was restored — remove from trash
              setImages((prev) => prev.filter((img) => img.id !== updated.id))
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setImages((prev) => prev.filter((img) => img.id !== deletedId))
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

  const restore = useCallback(
    async (id: string) => {
      // Optimistic update
      setImages((prev) => prev.filter((img) => img.id !== id))

      const { error } = await supabase
        .from('user_images')
        .update({ deleted_at: null })
        .eq('id', id)

      if (error) {
        fetchTrashed()
        throw error
      }
    },
    [fetchTrashed],
  )

  const permanentDelete = useCallback(
    async (id: string) => {
      const image = images.find((img) => img.id === id)
      if (!image) return

      // Optimistic update
      setImages((prev) => prev.filter((img) => img.id !== id))

      const { error } = await supabase.from('user_images').delete().eq('id', id)

      if (error) {
        fetchTrashed()
        throw error
      }

      // Delete storage file
      await supabase.storage.from(BUCKET_NAME).remove([image.storage_path])

      // If this was a variation, check if its hidden root should be cleaned up
      const metadata = image.generation_metadata as Record<
        string,
        unknown
      > | null
      if (metadata?.generation_type === 'variation') {
        const rootId =
          (typeof metadata.root_image_id === 'string'
            ? metadata.root_image_id
            : null) ??
          (typeof metadata.source_image_id === 'string'
            ? metadata.source_image_id
            : null)
        if (rootId) {
          // Check if root is hidden and has no more living variations
          const { data: rootImage } = await supabase
            .from('user_images')
            .select('id, storage_path, hidden')
            .eq('id', rootId)
            .single()

          if (rootImage?.hidden) {
            const { count } = await supabase
              .from('user_images')
              .select('id', { count: 'exact', head: true })
              .or(
                `generation_metadata->>root_image_id.eq.${rootId},generation_metadata->>source_image_id.eq.${rootId}`,
              )
              .is('deleted_at', null)

            if (count === 0) {
              await supabase.from('user_images').delete().eq('id', rootId)
              if (rootImage.storage_path) {
                await supabase.storage
                  .from(BUCKET_NAME)
                  .remove([rootImage.storage_path])
              }
            }
          }
        }
      }
    },
    [images, fetchTrashed],
  )

  const emptyTrash = useCallback(async () => {
    const storagePaths = images.map((img) => img.storage_path)
    const ids = images.map((img) => img.id)

    // Optimistic clear
    setImages([])
    setImageUrls({})

    const { error } = await supabase.from('user_images').delete().in('id', ids)

    if (error) {
      fetchTrashed()
      throw error
    }

    if (storagePaths.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove(storagePaths)
    }
  }, [images, fetchTrashed])

  return {
    images,
    imageUrls,
    isLoading,
    restore,
    permanentDelete,
    emptyTrash,
  }
}
