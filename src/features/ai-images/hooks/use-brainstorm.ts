import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrainstormModelKey } from '@/features/ai-images/server/brainstorm-images.server'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import {
  BRAINSTORM_PROMPT,
  checkBrainstormImages,
  editPrompt,
  regenerateBrainstormImages,
  rewritePrompt,
} from '@/features/ai-images/server/brainstorm-images.server'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { CREDIT_COSTS } from '@/features/credits'

const POLL_INTERVAL_MS = 2000

export interface BrainstormImage {
  url: string | null
  loading: boolean
}

interface UseBrainstormOptions {
  accessToken: string | undefined
  credits: CreditsState
  model?: BrainstormModelKey
  refineModel: string
  aspectRatio?: string
  slotCount: number
  imagesPerPrompt: number
}

function makeEmptySlotImages(count: number): Array<BrainstormImage> {
  return Array.from({ length: count }, () => ({ url: null, loading: false }))
}

export function useBrainstorm({
  accessToken,
  credits,
  model,
  refineModel,
  aspectRatio,
  slotCount,
  imagesPerPrompt,
}: UseBrainstormOptions) {
  // Each slot has an array of images (length = imagesPerPrompt)
  const [images, setImages] = useState<Array<Array<BrainstormImage>>>(() =>
    Array.from({ length: slotCount }, () =>
      makeEmptySlotImages(imagesPerPrompt),
    ),
  )
  const [refineCounts, setRefineCounts] = useState<Array<Array<number>>>(() =>
    Array.from({ length: slotCount }, () =>
      Array.from({ length: imagesPerPrompt }, () => 0),
    ),
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [lockedSlots, setLockedSlots] = useState<Set<number>>(new Set())
  const [rewritingSlots, setRewritingSlots] = useState<Set<number>>(new Set())
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [editingSlots, setEditingSlots] = useState<Set<number>>(new Set())

  // Map requestId -> { slot, imageIndex }
  const requestIdToSlot = useRef<
    Map<string, { slot: number; imageIndex: number }>
  >(new Map())
  const pendingIds = useRef<Set<string>>(new Set())
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [prompts, setPrompts] = useState<Array<string>>(
    Array.from({ length: slotCount }, () => BRAINSTORM_PROMPT),
  )
  const slotPrompts = useRef<Array<string>>(
    Array.from({ length: slotCount }, () => BRAINSTORM_PROMPT),
  )
  const activeModel = useRef<BrainstormModelKey>('schnell')

  // Resize arrays when slotCount or imagesPerPrompt changes
  useEffect(() => {
    setImages((prev) => {
      if (prev.length === slotCount && prev[0]?.length === imagesPerPrompt)
        return prev
      return Array.from({ length: slotCount }, (_, i) => {
        const existing = prev[i] as Array<BrainstormImage> | undefined
        if (existing) {
          if (existing.length === imagesPerPrompt) return existing
          if (existing.length < imagesPerPrompt) {
            return [
              ...existing,
              ...makeEmptySlotImages(imagesPerPrompt - existing.length),
            ]
          }
          return existing.slice(0, imagesPerPrompt)
        }
        return makeEmptySlotImages(imagesPerPrompt)
      })
    })
    setRefineCounts((prev) => {
      if (prev.length === slotCount && prev[0]?.length === imagesPerPrompt)
        return prev
      return Array.from({ length: slotCount }, (_, i) => {
        const existing = prev[i]
        if (existing) {
          if (existing.length === imagesPerPrompt) return existing
          return Array.from(
            { length: imagesPerPrompt },
            (_, j) => existing[j] ?? 0,
          )
        }
        return Array.from({ length: imagesPerPrompt }, () => 0)
      })
    })
    // Resize prompts
    const currentLen = slotPrompts.current.length
    if (currentLen < slotCount) {
      for (let i = currentLen; i < slotCount; i++) {
        slotPrompts.current.push(BRAINSTORM_PROMPT)
      }
    } else if (currentLen > slotCount) {
      slotPrompts.current.length = slotCount
    }
    setPrompts([...slotPrompts.current])
    // Prune locked slots beyond new count
    setLockedSlots((prev) => {
      const next = new Set<number>()
      for (const s of prev) {
        if (s < slotCount) next.add(s)
      }
      return next.size === prev.size ? prev : next
    })
  }, [slotCount, imagesPerPrompt])

  const accessTokenRef = useRef(accessToken)
  useEffect(() => {
    accessTokenRef.current = accessToken
  }, [accessToken])

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    let polling = false
    pollTimer.current = setInterval(async () => {
      const token = accessTokenRef.current
      if (!token || pendingIds.current.size === 0 || polling) return
      polling = true

      try {
        const requestIds = Array.from(pendingIds.current)
        const results = await checkBrainstormImages({
          data: { accessToken: token, requestIds, model: activeModel.current },
        })

        const updates: Array<{
          slot: number
          imageIndex: number
          url: string | null
        }> = []
        for (const result of results) {
          const mapping = requestIdToSlot.current.get(result.requestId)
          if (!mapping) continue

          if (result.status === 'completed' && result.url) {
            updates.push({
              slot: mapping.slot,
              imageIndex: mapping.imageIndex,
              url: result.url,
            })
            pendingIds.current.delete(result.requestId)
          } else if (result.status === 'failed') {
            updates.push({
              slot: mapping.slot,
              imageIndex: mapping.imageIndex,
              url: null,
            })
            pendingIds.current.delete(result.requestId)
          }
        }

        if (updates.length > 0) {
          setImages((prev) => {
            const next = prev.map((row) => [...row])
            for (const { slot, imageIndex, url } of updates) {
              if (next[slot]) {
                next[slot][imageIndex] = { url, loading: false }
              }
            }
            return next
          })
        }

        if (pendingIds.current.size === 0) {
          stopPolling()
          setIsGenerating(false)
          setHasGenerated(true)
        }
      } catch (err) {
        console.error('[brainstorm] poll error:', err)
      } finally {
        polling = false
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling])

  useEffect(() => {
    return stopPolling
  }, [stopPolling])

  async function generate() {
    if (!accessToken || isGenerating) return

    const unlockedIndices = Array.from(
      { length: slotCount },
      (_, i) => i,
    ).filter((i) => !lockedSlots.has(i))

    if (unlockedIndices.length === 0) return

    // Pre-flight credit check: 1 credit per image
    const totalImages = unlockedIndices.length * imagesPerPrompt
    const cost = CREDIT_COSTS.image_gen * totalImages
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    stopPolling()
    requestIdToSlot.current = new Map()
    pendingIds.current = new Set()
    setIsGenerating(true)
    setHasGenerated(false)
    setImages((prev) => {
      const next = prev.map((row) => [...row])
      for (const i of unlockedIndices) {
        next[i] = makeEmptySlotImages(imagesPerPrompt).map((img) => ({
          ...img,
          loading: true,
        }))
      }
      return next
    })
    setRefineCounts((prev) => {
      const next = prev.map((row) => [...row])
      for (const i of unlockedIndices) {
        next[i] = Array.from({ length: imagesPerPrompt }, () => 0)
      }
      return next
    })

    try {
      activeModel.current = model ?? 'schnell'
      // Build prompts array: each unlocked prompt repeated imagesPerPrompt times
      const expandedPrompts: Array<string> = []
      const expandedMapping: Array<{ slot: number; imageIndex: number }> = []
      for (const i of unlockedIndices) {
        for (let imgIdx = 0; imgIdx < imagesPerPrompt; imgIdx++) {
          expandedPrompts.push(slotPrompts.current[i])
          expandedMapping.push({ slot: i, imageIndex: imgIdx })
        }
      }

      const { requestIds } = await regenerateBrainstormImages({
        data: {
          accessToken,
          prompts: expandedPrompts,
          model: model ?? 'schnell',
        },
      })

      requestIds.forEach((id, idx) => {
        requestIdToSlot.current.set(id, expandedMapping[idx])
        pendingIds.current.add(id)
      })

      startPolling()
    } catch (err) {
      console.error('[brainstorm] generate failed:', err)
      setImages((prev) => {
        const next = prev.map((row) => [...row])
        for (const i of unlockedIndices) {
          next[i] = makeEmptySlotImages(imagesPerPrompt)
        }
        return next
      })
      setIsGenerating(false)
    }
  }

  async function selectImage(
    url: string,
    slotIndex: number,
    imageIndex: number,
  ) {
    if (!accessToken) return

    const refineCost = CREDIT_COSTS.image_gen
    if (credits.balance !== null && credits.balance < refineCost) {
      credits.showInsufficientCredits(refineCost)
      return
    }

    setRefineCounts((prev) => {
      const next = prev.map((row) => [...row])
      if (next[slotIndex]) {
        next[slotIndex][imageIndex] = (next[slotIndex][imageIndex] ?? 0) + 1
      }
      return next
    })

    await generateImage({
      data: {
        prompt: slotPrompts.current[slotIndex] ?? BRAINSTORM_PROMPT,
        model: refineModel,
        accessToken,
        sourceImageUrl: url,
        isRefine: true,
        ...(aspectRatio ? { aspectRatio } : {}),
      },
    })
  }

  async function regenerateSlot(index: number, imageIndex?: number) {
    if (!accessToken || isGenerating) return

    const targetImageIndices =
      imageIndex !== undefined
        ? [imageIndex]
        : Array.from({ length: imagesPerPrompt }, (_, i) => i)

    setImages((prev) => {
      const next = prev.map((row) => [...row])
      for (const imgIdx of targetImageIndices) {
        if (next[index]) {
          next[index][imgIdx] = { url: null, loading: true }
        }
      }
      return next
    })

    try {
      activeModel.current = model ?? 'schnell'
      const slotPromptList = targetImageIndices.map(
        () => slotPrompts.current[index],
      )
      const { requestIds } = await regenerateBrainstormImages({
        data: {
          accessToken,
          prompts: slotPromptList,
          model: model ?? 'schnell',
        },
      })

      requestIds.forEach((id, idx) => {
        requestIdToSlot.current.set(id, {
          slot: index,
          imageIndex: targetImageIndices[idx],
        })
        pendingIds.current.add(id)
      })
      setIsGenerating(true)

      startPolling()
    } catch (err) {
      console.error('[brainstorm] regenerateSlot failed:', err)
      setImages((prev) => {
        const next = prev.map((row) => [...row])
        for (const imgIdx of targetImageIndices) {
          if (next[index]) {
            next[index][imgIdx] = { url: null, loading: false }
          }
        }
        return next
      })
    }
  }

  function clearPrompts() {
    for (let i = 0; i < slotCount; i++) {
      if (!lockedSlots.has(i)) {
        slotPrompts.current[i] = BRAINSTORM_PROMPT
      }
    }
    setPrompts([...slotPrompts.current])
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

  function setAllPrompts(value: string) {
    for (let i = 0; i < slotCount; i++) {
      if (!lockedSlots.has(i)) {
        slotPrompts.current[i] = value
      }
    }
    setPrompts([...slotPrompts.current])
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

  async function rewriteAllPrompts() {
    if (!accessToken) return

    const indices = Array.from({ length: slotCount }, (_, i) => i).filter(
      (i) => !lockedSlots.has(i),
    )
    if (indices.length === 0) return
    setRewritingSlots(new Set(indices))

    await Promise.allSettled(
      indices.map(async (i) => {
        try {
          const result = await rewritePrompt({
            data: {
              accessToken,
              prompt: slotPrompts.current[i],
            },
          })
          slotPrompts.current[i] = result.prompt
          setPrompts([...slotPrompts.current])
        } catch (err) {
          console.error(`[brainstorm] rewriteAllPrompts slot ${i} failed:`, err)
        } finally {
          setRewritingSlots((prev) => {
            const next = new Set(prev)
            next.delete(i)
            return next
          })
        }
      }),
    )
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
    setAllPrompts,
    toggleLock,
    rewriteSlotPrompt,
    rewriteAllPrompts,
    rewriteAndGenerateSlot,
    editSlotPrompt,
  }
}
