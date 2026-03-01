import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BRAINSTORM_PROMPT,
  brainstormImages,
  checkBrainstormImages,
} from '@/features/ai-images/server/brainstorm-images.server'
import { generateImage } from '@/features/ai-images/server/generate-image.server'

const BRAINSTORM_COUNT = 6
const POLL_INTERVAL_MS = 2000

interface BrainstormImage {
  url: string | null
  loading: boolean
}

interface UseBrainstormOptions {
  accessToken: string | undefined
}

export function useBrainstorm({ accessToken }: UseBrainstormOptions) {
  const [images, setImages] = useState<Array<BrainstormImage>>(
    Array.from({ length: BRAINSTORM_COUNT }, () => ({
      url: null,
      loading: false,
    })),
  )
  const [refineCounts, setRefineCounts] = useState<Array<number>>(
    Array.from({ length: BRAINSTORM_COUNT }, () => 0),
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  // Maps requestId → slot index (stable for one brainstorm run)
  const requestIdToSlot = useRef<Map<string, number>>(new Map())
  // Set of request IDs still waiting for a result
  const pendingIds = useRef<Set<string>>(new Set())
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    if (!accessToken || pendingIds.current.size === 0) return

    try {
      const requestIds = Array.from(pendingIds.current)
      const results = await checkBrainstormImages({
        data: { accessToken, requestIds },
      })

      // Process results and mutate refs OUTSIDE the state updater
      const updates: Array<{ slot: number; url: string | null }> = []
      for (const result of results) {
        const slot = requestIdToSlot.current.get(result.requestId)
        if (slot === undefined) continue

        if (result.status === 'completed' && result.url) {
          updates.push({ slot, url: result.url })
          pendingIds.current.delete(result.requestId)
        } else if (result.status === 'failed') {
          updates.push({ slot, url: null })
          pendingIds.current.delete(result.requestId)
        }
      }

      if (updates.length > 0) {
        setImages((prev) => {
          const next = [...prev]
          for (const { slot, url } of updates) {
            next[slot] = { url, loading: false }
          }
          return next
        })
      }

      if (pendingIds.current.size > 0) {
        pollTimer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS)
      } else {
        setIsGenerating(false)
        setHasGenerated(true)
      }
    } catch {
      stopPolling()
      setIsGenerating(false)
    }
  }, [accessToken, stopPolling])

  useEffect(() => {
    return stopPolling
  }, [stopPolling])

  async function trigger() {
    if (!accessToken || isGenerating) return

    stopPolling()
    requestIdToSlot.current = new Map()
    pendingIds.current = new Set()
    setIsGenerating(true)
    setHasGenerated(false)
    setImages(
      Array.from({ length: BRAINSTORM_COUNT }, () => ({
        url: null,
        loading: true,
      })),
    )
    setRefineCounts(Array.from({ length: BRAINSTORM_COUNT }, () => 0))

    try {
      const { requestIds } = await brainstormImages({ data: { accessToken } })

      requestIds.forEach((id, idx) => {
        requestIdToSlot.current.set(id, idx)
        pendingIds.current.add(id)
      })

      pollTimer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    } catch {
      setImages(
        Array.from({ length: BRAINSTORM_COUNT }, () => ({
          url: null,
          loading: false,
        })),
      )
      setIsGenerating(false)
    }
  }

  async function selectImage(url: string, slotIndex: number) {
    if (!accessToken) return

    setRefineCounts((prev) => {
      const next = [...prev]
      next[slotIndex] = (next[slotIndex] ?? 0) + 1
      return next
    })

    await generateImage({
      data: {
        prompt: BRAINSTORM_PROMPT,
        model: 'fal-ai/nano-banana-pro',
        accessToken,
        sourceImageUrl: url,
      },
    })
  }

  return {
    images,
    refineCounts,
    isGenerating,
    hasGenerated,
    trigger,
    selectImage,
  }
}
