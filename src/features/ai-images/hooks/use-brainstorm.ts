import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrainstormModelKey } from '@/features/ai-images/server/brainstorm-images.server'
import {
  BRAINSTORM_PROMPT,
  checkBrainstormImages,
  editPrompt,
  regenerateBrainstormImages,
  rewritePrompt,
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
  model?: BrainstormModelKey
  refineModels?: Array<string>
  aspectRatio?: string
}

export function useBrainstorm({
  accessToken,
  model,
  refineModels,
  aspectRatio,
}: UseBrainstormOptions) {
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
  const [lockedSlots, setLockedSlots] = useState<Set<number>>(new Set())
  const [rewritingSlots, setRewritingSlots] = useState<Set<number>>(new Set())
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [editingSlots, setEditingSlots] = useState<Set<number>>(new Set())

  const requestIdToSlot = useRef<Map<string, number>>(new Map())
  const pendingIds = useRef<Set<string>>(new Set())
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [prompts, setPrompts] = useState<Array<string>>(
    Array.from({ length: BRAINSTORM_COUNT }, () => BRAINSTORM_PROMPT),
  )
  const slotPrompts = useRef<Array<string>>(
    Array.from({ length: BRAINSTORM_COUNT }, () => BRAINSTORM_PROMPT),
  )
  const activeModel = useRef<BrainstormModelKey>('schnell')

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
        data: { accessToken, requestIds, model: activeModel.current },
      })

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

  async function generate() {
    if (!accessToken || isGenerating) return

    const unlockedIndices = Array.from(
      { length: BRAINSTORM_COUNT },
      (_, i) => i,
    ).filter((i) => !lockedSlots.has(i))

    if (unlockedIndices.length === 0) return

    stopPolling()
    requestIdToSlot.current = new Map()
    pendingIds.current = new Set()
    setIsGenerating(true)
    setHasGenerated(false)
    setImages((prev) => {
      const next = [...prev]
      for (const i of unlockedIndices) {
        next[i] = { url: null, loading: true }
      }
      return next
    })
    setRefineCounts((prev) => {
      const next = [...prev]
      for (const i of unlockedIndices) {
        next[i] = 0
      }
      return next
    })

    try {
      activeModel.current = model ?? 'schnell'
      const unlockedPrompts = unlockedIndices.map((i) => slotPrompts.current[i])
      const { requestIds } = await regenerateBrainstormImages({
        data: {
          accessToken,
          prompts: unlockedPrompts,
          model: model ?? 'schnell',
        },
      })

      requestIds.forEach((id, idx) => {
        requestIdToSlot.current.set(id, unlockedIndices[idx])
        pendingIds.current.add(id)
      })

      pollTimer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    } catch (err) {
      console.error('[brainstorm] generate failed:', err)
      setImages((prev) => {
        const next = [...prev]
        for (const i of unlockedIndices) {
          next[i] = { url: null, loading: false }
        }
        return next
      })
      setIsGenerating(false)
    }
  }

  async function selectImage(url: string, slotIndex: number) {
    if (!accessToken) return

    const models = refineModels?.length ? refineModels : ['fal-ai/flux-2-pro']

    setRefineCounts((prev) => {
      const next = [...prev]
      next[slotIndex] = (next[slotIndex] ?? 0) + models.length
      return next
    })

    await Promise.all(
      models.map((modelId) =>
        generateImage({
          data: {
            prompt: slotPrompts.current[slotIndex] ?? BRAINSTORM_PROMPT,
            model: modelId,
            accessToken,
            sourceImageUrl: url,
            ...(aspectRatio ? { aspectRatio } : {}),
          },
        }),
      ),
    )
  }

  async function regenerateSlot(index: number) {
    if (!accessToken || isGenerating) return

    setImages((prev) => {
      const next = [...prev]
      next[index] = { url: null, loading: true }
      return next
    })

    try {
      activeModel.current = model ?? 'schnell'
      const { requestIds } = await regenerateBrainstormImages({
        data: {
          accessToken,
          prompts: [slotPrompts.current[index]],
          model: model ?? 'schnell',
        },
      })

      requestIdToSlot.current.set(requestIds[0], index)
      pendingIds.current.add(requestIds[0])
      setIsGenerating(true)

      pollTimer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    } catch (err) {
      console.error('[brainstorm] regenerateSlot failed:', err)
      setImages((prev) => {
        const next = [...prev]
        next[index] = { url: null, loading: false }
        return next
      })
    }
  }

  function clearPrompts() {
    const empty = Array.from(
      { length: BRAINSTORM_COUNT },
      () => BRAINSTORM_PROMPT,
    )
    slotPrompts.current = empty
    setPrompts(empty)
  }

  function toggleLock(index: number) {
    setLockedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function updatePrompt(index: number, value: string) {
    slotPrompts.current[index] = value
    setPrompts([...slotPrompts.current])
    setLockedSlots((prev) => {
      if (!prev.has(index)) return prev
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  async function rewriteSlotPrompt(index: number) {
    if (!accessToken) return

    setRewritingSlots((prev) => new Set(prev).add(index))

    try {
      const result = await rewritePrompt({
        data: {
          accessToken,
          prompt: slotPrompts.current[index],
        },
      })
      const { prompt } = result
      slotPrompts.current[index] = prompt
      setPrompts([...slotPrompts.current])
    } catch (err) {
      console.error('[brainstorm] rewriteSlotPrompt failed:', err)
    } finally {
      setRewritingSlots((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  async function editSlotPrompt(index: number, editInstruction: string) {
    if (!accessToken) return

    setEditingSlots((prev) => new Set(prev).add(index))

    try {
      const { prompt } = await editPrompt({
        data: {
          accessToken,
          prompt: slotPrompts.current[index],
          editInstruction,
        },
      })
      slotPrompts.current[index] = prompt
      setPrompts([...slotPrompts.current])
    } catch (err) {
      console.error('[brainstorm] editSlotPrompt failed:', err)
    } finally {
      setEditingSlots((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  async function rewriteAndGenerateSlot(index: number) {
    await rewriteSlotPrompt(index)
    void regenerateSlot(index)
  }

  return {
    images,
    prompts,
    refineCounts,
    isGenerating,
    hasGenerated,
    lockedSlots,
    rewritingSlots,
    editingSlot,
    setEditingSlot,
    editingSlots,
    generate,
    regenerateSlot,
    clearPrompts,
    selectImage,
    updatePrompt,
    toggleLock,
    rewriteSlotPrompt,
    rewriteAndGenerateSlot,
    editSlotPrompt,
  }
}
