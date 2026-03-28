import { useCallback, useEffect, useState } from 'react'
import type { UserImage } from '@/features/user-images/types'
import { removeImages } from '@/features/user-images/server/remove-images.server'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('No active session')
  return session.access_token
}

interface UseTrashReturn {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  linkedImageIds: Set<string>
  linkedCounts: Record<string, number>
  canvasLinkedIds: Set<string>
  restore: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  permanentDeleteMany: (ids: Array<string>) => Promise<void>
  restoreMany: (ids: Array<string>) => Promise<void>
  emptyTrash: () => Promise<void>
  signFullResUrls: (imgs: Array<UserImage>) => Promise<Record<string, string>>
}

/**
 * Checks which trashed image IDs are referenced by living (non-deleted, non-hidden)
 * images via source_image_id or root_image_id in generation_metadata,
 * or are currently placed on the canvas (on_canvas = true).
 */
async function fetchLinkedIds(trashedIds: Array<string>): Promise<{
  ids: Set<string>
  counts: Record<string, number>
  canvasIds: Set<string>
}> {
  const ids = new Set<string>()
  const counts: Record<string, number> = {}
  const canvasIds = new Set<string>()

  if (trashedIds.length === 0) return { ids, counts, canvasIds }

  const trashedSet = new Set(trashedIds)

  // Fetch all living images that have generation_metadata
  const { data: livingImages } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .is('deleted_at', null)
    .eq('hidden', false)
    .not('generation_metadata', 'is', null)

  if (livingImages) {
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
  }

  // Check which trashed images are still on the canvas
  const { data: onCanvasRows } = await supabase
    .from('user_images')
    .select('id')
    .in('id', trashedIds)
    .eq('on_canvas', true)

  if (onCanvasRows) {
    for (const row of onCanvasRows) {
      canvasIds.add(row.id)
      ids.add(row.id)
    }
  }

  return { ids, counts, canvasIds }
}

export function useTrash(userId: string | undefined): UseTrashReturn {
  const [images, setImages] = useState<Array<UserImage>>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [linkedImageIds, setLinkedImageIds] = useState<Set<string>>(new Set())
  const [linkedCounts, setLinkedCounts] = useState<Record<string, number>>({})
  const [canvasLinkedIds, setCanvasLinkedIds] = useState<Set<string>>(new Set())

  const refreshLinked = useCallback(async (trashedImages: Array<UserImage>) => {
    const { ids, counts, canvasIds } = await fetchLinkedIds(
      trashedImages.map((img) => img.id),
    )
    setLinkedImageIds(ids)
    setLinkedCounts(counts)
    setCanvasLinkedIds(canvasIds)
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
      const storage = createImageStorage(supabase)
      for (const image of data) {
        storage
          .getUrl(image.storage_path, {
            transform: { width: 400, resize: 'contain', quality: 80 },
            cached: false,
          })
          .then((url) => {
            if (url) {
              setImageUrls((prev) => ({
                ...prev,
                [image.id]: url,
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
              createImageStorage(supabase)
                .getUrl(updated.storage_path, {
                  transform: { width: 400, resize: 'contain', quality: 80 },
                  cached: false,
                })
                .then((url) => {
                  if (url) {
                    setImageUrls((prev) => ({
                      ...prev,
                      [updated.id]: url,
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

      const accessToken = await getAccessToken()
      await removeImages({
        data: { accessToken, storagePaths: [image.storage_path] },
      })

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
                await removeImages({
                  data: {
                    accessToken,
                    storagePaths: [rootImage.storage_path],
                  },
                })
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

      const accessToken = await getAccessToken()
      if (storagePaths.length > 0) {
        await removeImages({ data: { accessToken, storagePaths } })
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
                  await removeImages({
                    data: {
                      accessToken,
                      storagePaths: [rootImage.storage_path],
                    },
                  })
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
      const accessToken = await getAccessToken()
      await removeImages({ data: { accessToken, storagePaths } })
    }
  }, [images, fetchTrashed, linkedImageIds])

  const signFullResUrls = useCallback(
    async (imgs: Array<UserImage>): Promise<Record<string, string>> => {
      const urls: Record<string, string> = {}
      const storage = createImageStorage(supabase)
      const BATCH = 10
      for (let i = 0; i < imgs.length; i += BATCH) {
        const batch = imgs.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map((img) =>
            storage
              .getUrl(img.storage_path, { ttl: 3600, cached: false })
              .then((url) => ({
                id: img.id,
                url,
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
    canvasLinkedIds,
    restore,
    permanentDelete,
    permanentDeleteMany,
    restoreMany,
    emptyTrash,
    signFullResUrls,
  }
}
