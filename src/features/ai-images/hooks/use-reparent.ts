import { useCallback, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { reparentImage } from '@/features/ai-images/server/reparent-image.server'

interface UseReparentOptions {
  accessToken: string | undefined
  onComplete: () => void
}

export function useReparent({ accessToken, onComplete }: UseReparentOptions) {
  const [adoptTarget, setAdoptTarget] = useState<SavedAiImage | null>(null)
  const [isReparenting, setIsReparenting] = useState(false)

  const startAdopt = useCallback((img: SavedAiImage) => {
    setAdoptTarget(img)
  }, [])

  const cancelAdopt = useCallback(() => {
    setAdoptTarget(null)
  }, [])

  const confirmAdopt = useCallback(
    async (newParentId: string) => {
      if (!accessToken || !adoptTarget) return
      setIsReparenting(true)
      try {
        await reparentImage({
          data: {
            accessToken,
            imageId: adoptTarget.id,
            action: 'adopt',
            newParentId,
          },
        })
        setAdoptTarget(null)
        onComplete()
      } catch (err) {
        console.error('Adopt failed:', err)
      } finally {
        setIsReparenting(false)
      }
    },
    [accessToken, adoptTarget, onComplete],
  )

  const detach = useCallback(
    async (imageId: string) => {
      if (!accessToken) return
      setIsReparenting(true)
      try {
        await reparentImage({
          data: {
            accessToken,
            imageId,
            action: 'detach',
          },
        })
        onComplete()
      } catch (err) {
        console.error('Detach failed:', err)
      } finally {
        setIsReparenting(false)
      }
    },
    [accessToken, onComplete],
  )

  return {
    adoptTarget,
    isReparenting,
    startAdopt,
    cancelAdopt,
    confirmAdopt,
    detach,
  }
}
