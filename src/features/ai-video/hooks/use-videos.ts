import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiVideo } from '../video-types'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { createImageStorage } from '@/lib/image-storage'
import { ungroupVideos } from '@/features/ai-video/server/ungroup-videos.server'

interface UseVideosOptions {
  userId: string | undefined
  accessToken: string | undefined
}

/**
 * Sort videos newest-first, with "parent bubble" so a parent video floats to
 * the top when any of its children (videos sharing its parent_id) gets a new gen.
 */
function sortByOrder(videos: Array<SavedAiVideo>): Array<SavedAiVideo> {
  const newestDescendant = new Map<string, number>()
  for (const v of videos) {
    const parentId = v.generation_metadata?.parent_id
    if (parentId) {
      const t = new Date(v.created_at).getTime() / 1000
      const current = newestDescendant.get(parentId) ?? 0
      if (t > current) newestDescendant.set(parentId, t)
    }
  }

  return [...videos].sort((a, b) => {
    const aOwn = a.sort_order ?? new Date(a.created_at).getTime() / 1000
    const bOwn = b.sort_order ?? new Date(b.created_at).getTime() / 1000
    const aEffective = Math.max(aOwn, newestDescendant.get(a.id) ?? 0)
    const bEffective = Math.max(bOwn, newestDescendant.get(b.id) ?? 0)
    return bEffective - aEffective
  })
}

export interface VideoGalleryState {
  videos: Array<SavedAiVideo>
  /** Poster thumbnail URL (start image / first frame) keyed by video id */
  thumbnailUrls: Record<string, string>
  loadingGallery: boolean
  deleteVideo: (v: SavedAiVideo) => Promise<void>
  addOptimisticCard: (card: SavedAiVideo) => void
  replaceOptimisticCard: (optimisticId: string, realCard: SavedAiVideo) => void
  removeOptimisticCard: (optimisticId: string) => void
  ungroupChildren: (v: SavedAiVideo) => Promise<void>
  refresh: () => Promise<void>
}

function getThumbnailPath(v: SavedAiVideo): string | null {
  const meta = v.generation_metadata
  if (!meta) return null
  // Multishot stores start_image_url, FLF stores first_frame_url
  const candidate =
    (meta as { start_image_url?: string }).start_image_url ??
    (meta as { first_frame_url?: string }).first_frame_url ??
    null
  return candidate
}

export function useVideos({
  userId,
  accessToken,
}: UseVideosOptions): VideoGalleryState {
  const [videos, setVideos] = useState<Array<SavedAiVideo>>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})
  const [loadingGallery, setLoadingGallery] = useState(true)

  const loadVideos = useCallback(async () => {
    if (!userId) return

    try {
      setLoadingGallery(true)
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select(
          'id, title, storage_path, thumbnail_path, created_at, sort_order, status, generation_error, generation_metadata',
        )
        .eq('user_id', userId)
        .eq('source', 'ai_video')
        .is('deleted_at', null)
        .order('sort_order', { ascending: false, nullsFirst: false })

      if (queryError) throw queryError

      const all = data as Array<SavedAiVideo>
      const sorted = sortByOrder(all)
      setVideos(sorted)

      // Resolve thumbnail URLs. The stored url could be:
      // - an R2 public URL (already usable)
      // - a signed storage URL (may be expired; try resolving path)
      // - a library image reference we can't directly use
      // For simplicity we just use whatever's stored in the snapshot.
      // If it's an expired signed URL the card will fail to load an image;
      // future work can re-sign from storage_path on demand.
      const urls: Record<string, string> = {}
      for (const v of sorted) {
        const path = getThumbnailPath(v)
        if (path) urls[v.id] = path
      }
      setThumbnailUrls(urls)
    } catch {
      console.error('Failed to load videos')
    } finally {
      setLoadingGallery(false)
    }
  }, [userId])

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  // Realtime subscription for video rows
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('user_videos_changes')
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
            const raw = payload.new as Record<string, unknown>
            if (raw.source !== 'ai_video') return
            const newVideo = payload.new as SavedAiVideo

            setVideos((prev) => {
              if (prev.some((v) => v.id === newVideo.id)) return prev

              // Check for optimistic placeholder
              const optimisticIdx = prev.findIndex((v) =>
                v.id.startsWith('optimistic-'),
              )
              if (optimisticIdx !== -1) {
                return prev.map((v, i) => (i === optimisticIdx ? newVideo : v))
              }

              // Bump parent's sort_order when a child is added
              const parentId = newVideo.generation_metadata?.parent_id
              const bumpedSort = Date.now() / 1000
              let next = [...prev, newVideo]
              if (parentId) {
                next = next.map((v) =>
                  v.id === parentId ? { ...v, sort_order: bumpedSort } : v,
                )
                // Persist the bump
                void supabase
                  .from('user_images')
                  .update({ sort_order: bumpedSort })
                  .eq('id', parentId)
              }
              return sortByOrder(next)
            })

            // Add thumbnail URL for the new video
            const thumb = getThumbnailPath(newVideo)
            if (thumb) {
              setThumbnailUrls((prev) => ({ ...prev, [newVideo.id]: thumb }))
            }
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new as Record<string, unknown>
            if (raw.source !== 'ai_video') return
            const updated = payload.new as SavedAiVideo

            if (updated.deleted_at) {
              setVideos((prev) => prev.filter((v) => v.id !== updated.id))
              setThumbnailUrls((prev) => {
                const next = { ...prev }
                delete next[updated.id]
                return next
              })
              return
            }

            setVideos((prev) => {
              const exists = prev.some((v) => v.id === updated.id)
              if (exists) {
                return prev.map((v) => (v.id === updated.id ? updated : v))
              }
              return sortByOrder([...prev, updated])
            })

            const thumb = getThumbnailPath(updated)
            if (thumb) {
              setThumbnailUrls((prev) => ({ ...prev, [updated.id]: thumb }))
            }
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id
            if (!deletedId) return
            setVideos((prev) => prev.filter((v) => v.id !== deletedId))
            setThumbnailUrls((prev) => {
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

  // Poll FAL for pending videos (skipped when webhooks are enabled)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_FAL_WEBHOOKS === 'true') return
    if (!accessToken) return

    const hasPending = videos.some(
      (v) => v.status === 'pending' || v.status === 'processing',
    )

    if (hasPending && !pollingRef.current) {
      checkPendingGenerations({ data: { accessToken } }).catch(() => {})
      pollingRef.current = setInterval(() => {
        checkPendingGenerations({ data: { accessToken } }).catch(() => {})
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
  }, [videos, accessToken])

  // Resolve thumbnail URL from storage_path if needed -- for videos the
  // thumbnail lives in generation_metadata.start_image_url/first_frame_url.
  // If that URL is an R2 storage path rather than a full URL, resolve it.
  useEffect(() => {
    const needsResolving = videos.filter((v) => {
      const current = thumbnailUrls[v.id]
      return (
        current &&
        !current.startsWith('http') &&
        !current.startsWith('data:') &&
        !current.startsWith('blob:')
      )
    })
    if (needsResolving.length === 0) return

    Promise.all(
      needsResolving.map(async (v) => {
        const path = thumbnailUrls[v.id]
        const url = await createImageStorage(supabase).getUrl(path)
        return url ? ([v.id, url] as const) : null
      }),
    ).then((entries) => {
      const resolved: Record<string, string> = {}
      for (const entry of entries) {
        if (entry) resolved[entry[0]] = entry[1]
      }
      if (Object.keys(resolved).length > 0) {
        setThumbnailUrls((prev) => ({ ...prev, ...resolved }))
      }
    })
  }, [videos, thumbnailUrls])

  const deleteVideo = useCallback(
    async (v: SavedAiVideo) => {
      // Optimistic removal
      setVideos((prev) => prev.filter((x) => x.id !== v.id))
      try {
        const { error } = await supabase
          .from('user_images')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', v.id)
        if (error) throw error
      } catch {
        // Reload on failure
        void loadVideos()
      }
    },
    [loadVideos],
  )

  const addOptimisticCard = useCallback((card: SavedAiVideo) => {
    setVideos((prev) => sortByOrder([card, ...prev]))
  }, [])

  const replaceOptimisticCard = useCallback(
    (optimisticId: string, realCard: SavedAiVideo) => {
      setVideos((prev) =>
        sortByOrder(prev.map((v) => (v.id === optimisticId ? realCard : v))),
      )
    },
    [],
  )

  const removeOptimisticCard = useCallback((optimisticId: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== optimisticId))
  }, [])

  const ungroupChildren = useCallback(
    async (v: SavedAiVideo) => {
      if (!accessToken) return
      await ungroupVideos({ data: { accessToken, parentId: v.id } })
      await loadVideos()
    },
    [accessToken, loadVideos],
  )

  return {
    videos,
    thumbnailUrls,
    loadingGallery,
    deleteVideo,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    ungroupChildren,
    refresh: loadVideos,
  }
}
