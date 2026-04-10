import { useCallback, useState } from 'react'
import { reparentVideo } from '../server/reparent-video.server'
import type { SavedAiVideo } from '../video-types'

interface UseReparentVideoOptions {
  accessToken: string | undefined
  onComplete: () => void
}

export function useReparentVideo({
  accessToken,
  onComplete,
}: UseReparentVideoOptions) {
  const [adoptTarget, setAdoptTarget] = useState<SavedAiVideo | null>(null)
  const [adoptBatch, setAdoptBatch] = useState<Array<SavedAiVideo> | null>(null)
  const [isReparenting, setIsReparenting] = useState(false)

  const startAdopt = useCallback((video: SavedAiVideo) => {
    setAdoptTarget(video)
    setAdoptBatch(null)
  }, [])

  const startAdoptBatch = useCallback((videos: Array<SavedAiVideo>) => {
    if (videos.length === 0) return
    setAdoptTarget(videos[0])
    setAdoptBatch(videos)
  }, [])

  const cancelAdopt = useCallback(() => {
    setAdoptTarget(null)
    setAdoptBatch(null)
  }, [])

  const confirmAdopt = useCallback(
    async (newParentId: string) => {
      if (!accessToken || !adoptTarget) return
      setIsReparenting(true)
      try {
        const targets = adoptBatch ?? [adoptTarget]
        await Promise.all(
          targets.map((v) =>
            reparentVideo({
              data: {
                accessToken,
                videoId: v.id,
                action: 'adopt',
                newParentId,
              },
            }),
          ),
        )
        setAdoptTarget(null)
        setAdoptBatch(null)
        onComplete()
      } catch (err) {
        console.error('Video adopt failed:', err)
      } finally {
        setIsReparenting(false)
      }
    },
    [accessToken, adoptTarget, adoptBatch, onComplete],
  )

  const detach = useCallback(
    async (videoId: string) => {
      if (!accessToken) return
      setIsReparenting(true)
      try {
        await reparentVideo({
          data: { accessToken, videoId, action: 'detach' },
        })
        onComplete()
      } catch (err) {
        console.error('Video detach failed:', err)
      } finally {
        setIsReparenting(false)
      }
    },
    [accessToken, onComplete],
  )

  return {
    adoptTarget,
    adoptBatch,
    isReparenting,
    startAdopt,
    startAdoptBatch,
    cancelAdopt,
    confirmAdopt,
    detach,
  }
}
