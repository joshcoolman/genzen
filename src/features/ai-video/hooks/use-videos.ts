import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedAiVideo } from '../video-types'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { getR2PublicUrl } from '@/lib/image-storage'
import { ungroupVideos } from '@/features/ai-video/server/ungroup-videos.server'
import { extractVideoThumbnail } from '@/features/ai-video/server/extract-video-thumbnail.server'
import { uploadVideoThumbnail } from '@/features/ai-video/server/upload-video-thumbnail.server'

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
  captureFrame: (v: SavedAiVideo, imageBase64: string) => Promise<void>
  removeThumbnail: (v: SavedAiVideo) => Promise<void>
  addOptimisticCard: (card: SavedAiVideo) => void
  replaceOptimisticCard: (optimisticId: string, realCard: SavedAiVideo) => void
  removeOptimisticCard: (optimisticId: string) => void
  markOptimisticFailed: (id: string, error: Error) => void
  ungroupChildren: (v: SavedAiVideo) => Promise<void>
  refresh: () => Promise<void>
}

function getThumbnailUrl(v: SavedAiVideo): string | null {
  // Prefer the extracted / user-picked thumbnail stored as an R2 path --
  // we resolve it synchronously to a public URL so there's no flash of a
  // raw relative path hitting <img src>. Append a cache-bust based on the
  // server-stamped thumbnail_updated_at so picking a new frame actually
  // reloads (same storage_path + same URL = browser cache hit otherwise).
  if (v.thumbnail_path) {
    try {
      const base = getR2PublicUrl(v.thumbnail_path)
      const stamp = (
        v.generation_metadata as { thumbnail_updated_at?: number } | null
      )?.thumbnail_updated_at
      return stamp ? `${base}?v=${stamp}` : base
    } catch {
      // fall through to source frame
    }
  }

  const meta = v.generation_metadata
  if (!meta) return null
  // Source start / first frame URL is already a full http URL (stored at
  // generation time from the user's library or outpaint flow).
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
        const path = getThumbnailUrl(v)
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
            const thumb = getThumbnailUrl(newVideo)
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

            const thumb = getThumbnailUrl(updated)
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

  // Thumbnail URLs are resolved synchronously in getThumbnailUrl via
  // getR2PublicUrl, so no async resolver effect is needed. Stored paths
  // turn into full public URLs the moment they land in state, which
  // prevents a brief 404 flash of the raw R2 path hitting <img src>.

  // Auto-extract middle-frame thumbnail for any completed video that doesn't
  // have one yet. Runs on mount and whenever the video list changes (e.g. a
  // new gen completes via realtime). Extraction is server-side via FAL ffmpeg
  // and cheap (~$0.001 per 5s video). In-flight guard prevents duplicate
  // calls on re-renders. Videos with generation_metadata.thumbnail_cleared
  // are skipped -- those are ones the user explicitly removed.
  const extractingRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!accessToken) return
    const candidates = videos.filter(
      (v) =>
        v.status === 'completed' &&
        !v.thumbnail_path &&
        !(v.generation_metadata as { thumbnail_cleared?: boolean } | null)
          ?.thumbnail_cleared &&
        typeof v.generation_metadata?.fal_url === 'string' &&
        !extractingRef.current.has(v.id),
    )
    if (candidates.length === 0) return

    for (const v of candidates) {
      extractingRef.current.add(v.id)
      extractVideoThumbnail({
        data: { accessToken, videoId: v.id },
      })
        .catch(() => {
          // silent -- gallery falls back to source frame
        })
        .finally(() => {
          extractingRef.current.delete(v.id)
        })
    }
  }, [videos, accessToken])

  const captureFrame = useCallback(
    async (v: SavedAiVideo, imageBase64: string) => {
      if (!accessToken) return
      try {
        await uploadVideoThumbnail({
          data: { accessToken, videoId: v.id, imageBase64 },
        })
      } catch (err) {
        console.error('[use-videos] capture frame failed', err)
      }
    },
    [accessToken],
  )

  const removeThumbnail = useCallback(async (v: SavedAiVideo) => {
    // Null the thumbnail path and set the "cleared" flag so the auto-
    // extractor won't immediately put a new one back. The card falls back
    // to the source start/first frame.
    try {
      const existing = (v.generation_metadata ?? {}) as Record<string, unknown>
      const nextMeta = { ...existing, thumbnail_cleared: true }
      await supabase
        .from('user_images')
        .update({
          thumbnail_path: null,
          generation_metadata: nextMeta as never,
        })
        .eq('id', v.id)
    } catch {
      // silent
    }
  }, [])

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

  const markOptimisticFailed = useCallback((id: string, error: Error) => {
    setVideos((prev) =>
      prev.map(
        (v): SavedAiVideo =>
          v.id === id
            ? {
                ...v,
                status: 'failed' as const,
                generation_error: error.message,
              }
            : v,
      ),
    )
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
    captureFrame,
    removeThumbnail,
    addOptimisticCard,
    replaceOptimisticCard,
    removeOptimisticCard,
    markOptimisticFailed,
    ungroupChildren,
    refresh: loadVideos,
  }
}
