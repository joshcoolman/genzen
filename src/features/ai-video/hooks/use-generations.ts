import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Generation } from '../types'
import { getGenerations } from '@/features/ai-video/server/get-generations.server'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'

export interface FirstFrameGroup {
  firstFrameId: string
  firstFrameUrl: string | null
  generations: Array<Generation>
  latestDate: string
}

export function useGenerations(
  workspaceId: string,
  accessToken: string | undefined,
) {
  const [generations, setGenerations] = useState<Array<Generation>>([])
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    getGenerations({
      data: { workspaceId, accessToken },
    })
      .then(setGenerations)
      .catch(() => {})
  }, [workspaceId, accessToken])

  // Poll for pending videos and last frames
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const hasPending = generations.some(
      (g) => g.video?.status === 'pending' || g.lastFrame?.status === 'pending',
    )
    if (!hasPending || !accessToken) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    checkPendingGenerations({ data: { accessToken } }).catch(() => {})
    pollingRef.current = setInterval(() => {
      checkPendingGenerations({ data: { accessToken } }).catch(() => {})
    }, 5000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [generations, accessToken])

  // Realtime subscriptions for all pending videos and last frames
  useEffect(() => {
    const pendingVideos = generations.filter(
      (g) => g.video?.status === 'pending' && g.video.id,
    )
    const pendingLastFrames = generations.filter(
      (g) => g.lastFrame?.status === 'pending' && g.lastFrame.id,
    )

    if (pendingVideos.length === 0 && pendingLastFrames.length === 0) return

    const channels: Array<ReturnType<typeof supabase.channel>> = []

    for (const gen of pendingVideos) {
      const videoRecordId = gen.video!.id
      const channel = supabase
        .channel(`video_${videoRecordId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_images',
            filter: `id=eq.${videoRecordId}`,
          },
          (payload) => {
            const updated = payload.new as {
              status: string
              generation_metadata: Record<string, unknown> | null
            }
            if (updated.status === 'completed') {
              const falUrl = updated.generation_metadata?.fal_url as
                | string
                | undefined
              if (falUrl) {
                setGenerations((prev) =>
                  prev.map((g) =>
                    g.id === gen.id
                      ? {
                          ...g,
                          video: {
                            id: videoRecordId,
                            url: falUrl,
                            status: 'completed',
                          },
                        }
                      : g,
                  ),
                )
              }
            } else if (updated.status === 'failed') {
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === gen.id
                    ? {
                        ...g,
                        video: {
                          id: videoRecordId,
                          url: null,
                          status: 'failed',
                        },
                      }
                    : g,
                ),
              )
            }
          },
        )
        .subscribe()
      channels.push(channel)
    }

    for (const gen of pendingLastFrames) {
      const lastFrameRecordId = gen.lastFrame!.id
      const channel = supabase
        .channel(`last_frame_${lastFrameRecordId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_images',
            filter: `id=eq.${lastFrameRecordId}`,
          },
          (payload) => {
            const updated = payload.new as {
              status: string
              storage_path: string | null
            }
            if (updated.status === 'completed' && updated.storage_path) {
              createImageStorage()
                .getUrl(updated.storage_path)
                .then((url) => {
                  if (url) {
                    setGenerations((prev) =>
                      prev.map((g) =>
                        g.id === gen.id
                          ? {
                              ...g,
                              lastFrame: {
                                id: lastFrameRecordId,
                                url,
                                status: 'completed',
                              },
                            }
                          : g,
                      ),
                    )
                  }
                })
                .catch(() => {})
            } else if (updated.status === 'failed') {
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === gen.id
                    ? {
                        ...g,
                        lastFrame: {
                          id: lastFrameRecordId,
                          url: null,
                          status: 'failed',
                        },
                      }
                    : g,
                ),
              )
            }
          },
        )
        .subscribe()
      channels.push(channel)
    }

    return () => {
      for (const ch of channels) {
        supabase.removeChannel(ch)
      }
    }
  }, [
    // Re-subscribe when the set of pending IDs changes
    generations
      .filter(
        (g) =>
          g.video?.status === 'pending' || g.lastFrame?.status === 'pending',
      )
      .map((g) => `${g.video?.id ?? ''}_${g.lastFrame?.id ?? ''}`)
      .join(','),
  ])

  // Group generations by first frame
  const firstFrameGroups = useMemo(() => {
    const map = new Map<string, FirstFrameGroup>()
    for (const gen of generations) {
      const ffId = gen.firstFrame?.id
      if (!ffId) continue
      const existing = map.get(ffId)
      if (existing) {
        existing.generations.push(gen)
        if (gen.createdAt > existing.latestDate) {
          existing.latestDate = gen.createdAt
        }
      } else {
        map.set(ffId, {
          firstFrameId: ffId,
          firstFrameUrl: gen.firstFrame?.url ?? null,
          generations: [gen],
          latestDate: gen.createdAt,
        })
      }
    }
    return Array.from(map.values())
  }, [generations])

  const addGeneration = useCallback((gen: Generation) => {
    setGenerations((prev) => [gen, ...prev])
  }, [])

  const updateGeneration = useCallback(
    (id: string, updates: Partial<Generation>) => {
      setGenerations((prev) =>
        prev.map((gen) => (gen.id === id ? { ...gen, ...updates } : gen)),
      )
    },
    [],
  )

  const deleteGeneration = useCallback((id: string) => {
    setGenerations((prev) => prev.filter((gen) => gen.id !== id))
  }, [])

  const removeByIds = useCallback((ids: Set<string>) => {
    setGenerations((prev) => prev.filter((g) => !ids.has(g.id)))
  }, [])

  return {
    generations,
    firstFrameGroups,
    isGeneratingVideo,
    setIsGeneratingVideo,
    addGeneration,
    updateGeneration,
    deleteGeneration,
    removeByIds,
  }
}
