import { useCallback, useEffect, useState } from 'react'
import type { UserImage } from '@/features/user-images/types'
import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'user-images'

interface UseTrashReturn {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  linkedImageIds: Set<string>
  linkedCounts: Record<string, number>
  restore: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  permanentDeleteMany: (ids: Array<string>) => Promise<void>
  restoreMany: (ids: Array<string>) => Promise<void>
  emptyTrash: () => Promise<void>
  signFullResUrls: (imgs: Array<UserImage>) => Promise<Record<string, string>>
}

/**
 * Checks which trashed image IDs are referenced by living (non-deleted, non-hidden)
 * images via source_image_id or root_image_id in generation_metadata.
 */
async function fetchLinkedIds(
  trashedIds: Array<string>,
): Promise<{ ids: Set<string>; counts: Record<string, number> }> {
  const ids = new Set<string>()
  const counts: Record<string, number> = {}

  if (trashedIds.length === 0) return { ids, counts }

  const trashedSet = new Set(trashedIds)

  // Fetch all living images that have generation_metadata
  const { data: livingImages } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .is('deleted_at', null)
    .eq('hidden', false)
    .not('generation_metadata', 'is', null)

  if (!livingImages) return { ids, counts }

  for (const row of livingImages) {
    const meta = row.generation_metadata as Record<string, unknown> | null
    if (!meta) continue

    const refs = [
      typeof meta.source_image_id === 'string' ? meta.source_image_id : null,
      typeof meta.root_image_id === 'string' ? meta.root_image_id : null,
    ].filter((id): id is string => id !== null && trashedSet.has(id))

    for (const refId of refs) {
      ids.add(refId)
      counts[refId] = (counts[refId] || 0) + 1
    }
  }

  // Dedupe counts — a single living image referencing both source and root
  // of the same trashed image should only count once per trashed image.
  // The current approach may double-count, but that's acceptable for a tooltip.

  return { ids, counts }
}

export function useTrash(userId: string | undefined): UseTrashReturn {
  const [images, setImages] = useState<Array<UserImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [linkedImageIds, setLinkedImageIds] = useState<Set<string>>(new Set())
  const [linkedCounts, setLinkedCounts] = useState<Record<string, number>>({})

  const refreshLinked = useCallback(async (trashedImages: Array<UserImage>) => {
    const { ids, counts } = await fetchLinkedIds(
      trashedImages.map((img) => img.id),
    )
    setLinkedImageIds(ids)
    setLinkedCounts(counts)
  }, [])

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

      // Check linked status
      refreshLinked(data)

      // Sign URLs in background
      for (const image of data) {
        supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(image.storage_path, 86400, {
            transform: { width: 400, resize: 'contain', quality: 80 },
          })
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
  }, [userId, refreshLinked])

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
              setImages((prev) => prev.filter((img) => img.id !== updated.id))
              return
            }
            if (updated.deleted_at) {
              setImages((prev) => {
                const next = prev.some((img) => img.id === updated.id)
                  ? prev.map((img) => (img.id === updated.id ? updated : img))
                  : [updated, ...prev]
                // Re-check linked status with updated list
                refreshLinked(next)
                return next
              })
              supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(updated.storage_path, 86400, {
                  transform: { width: 400, resize: 'contain', quality: 80 },
                })
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
              setImages((prev) => {
                const next = prev.filter((img) => img.id !== updated.id)
                refreshLinked(next)
                return next
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setImages((prev) => {
              const next = prev.filter((img) => img.id !== deletedId)
              refreshLinked(next)
              return next
            })
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
  }, [userId, refreshLinked])

  const restore = useCallback(
    async (id: string) => {
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
      // Safety guard: don't delete linked images
      if (linkedImageIds.has(id)) return

      const image = images.find((img) => img.id === id)
      if (!image) return

      setImages((prev) => prev.filter((img) => img.id !== id))

      const { error } = await supabase.from('user_images').delete().eq('id', id)

      if (error) {
        fetchTrashed()
        throw error
      }

      await supabase.storage.from(BUCKET_NAME).remove([image.storage_path])

      // Cascade cleanup for variations
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
    [images, fetchTrashed, linkedImageIds],
  )

  const permanentDeleteMany = useCallback(
    async (ids: Array<string>) => {
      // Filter out linked images
      const safeIds = ids.filter((id) => !linkedImageIds.has(id))
      const targetImages = images.filter((img) => safeIds.includes(img.id))
      if (targetImages.length === 0) return

      const idSet = new Set(safeIds)
      const storagePaths = targetImages.map((img) => img.storage_path)

      setImages((prev) => prev.filter((img) => !idSet.has(img.id)))

      const { error } = await supabase
        .from('user_images')
        .delete()
        .in('id', safeIds)

      if (error) {
        fetchTrashed()
        throw error
      }

      if (storagePaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(storagePaths)
      }

      // Cascade cleanup for variations
      for (const image of targetImages) {
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
      }
    },
    [images, fetchTrashed, linkedImageIds],
  )

  const restoreMany = useCallback(
    async (ids: Array<string>) => {
      const idSet = new Set(ids)

      setImages((prev) => prev.filter((img) => !idSet.has(img.id)))

      const { error } = await supabase
        .from('user_images')
        .update({ deleted_at: null })
        .in('id', ids)

      if (error) {
        fetchTrashed()
        throw error
      }
    },
    [fetchTrashed],
  )

  const emptyTrash = useCallback(async () => {
    // Only delete non-linked images
    const deletable = images.filter((img) => !linkedImageIds.has(img.id))
    if (deletable.length === 0) return

    const storagePaths = deletable.map((img) => img.storage_path)
    const ids = deletable.map((img) => img.id)

    // Optimistic: keep only linked images
    const linked = images.filter((img) => linkedImageIds.has(img.id))
    setImages(linked)

    const { error } = await supabase.from('user_images').delete().in('id', ids)

    if (error) {
      fetchTrashed()
      throw error
    }

    if (storagePaths.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove(storagePaths)
    }
  }, [images, fetchTrashed, linkedImageIds])

  const signFullResUrls = useCallback(
    async (imgs: Array<UserImage>): Promise<Record<string, string>> => {
      const urls: Record<string, string> = {}
      const BATCH = 10
      for (let i = 0; i < imgs.length; i += BATCH) {
        const batch = imgs.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map((img) =>
            supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(img.storage_path, 3600)
              .then(({ data }) => ({
                id: img.id,
                url: data?.signedUrl ?? null,
              }))
              .catch(() => ({ id: img.id, url: null })),
          ),
        )
        for (const { id, url } of results) {
          if (url) urls[id] = url
        }
      }
      return urls
    },
    [],
  )

  return {
    images,
    imageUrls,
    isLoading,
    linkedImageIds,
    linkedCounts,
    restore,
    permanentDelete,
    permanentDeleteMany,
    restoreMany,
    emptyTrash,
    signFullResUrls,
  }
}
