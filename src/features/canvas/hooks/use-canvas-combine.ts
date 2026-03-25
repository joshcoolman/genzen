import { useCallback, useRef, useState } from 'react'
import { getSignedUrl } from '../lib/persistence'
import type { CanvasImage } from '../types'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { CREDIT_COSTS } from '@/features/credits'

const COMBINE_MODEL = 'fal-ai/flux-2-pro/edit'

function getBounds(imgs: Array<CanvasImage>) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const img of imgs) {
    x0 = Math.min(x0, img.x)
    y0 = Math.min(y0, img.y)
    x1 = Math.max(x1, img.x + img.width)
    y1 = Math.max(y1, img.y + img.height)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function parseRatio(r: string): number {
  const [w, h] = r.split(':').map(Number)
  return w && h ? w / h : 1
}

export function useCanvasCombine(
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>,
  pushUndo: () => void,
) {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const credits = useCredits()

  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [sourceImages, setSourceImages] = useState<Array<CanvasImage>>([])
  const [labels, setLabels] = useState<Record<string, string | undefined>>({})
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [runsCount, setRunsCount] = useState(1)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingPlaceholdersRef = useRef<Array<string>>([])

  const handleAfterSubmit = useCallback(
    (results: Array<{ recordId: string }>) => {
      const placeholderIds = pendingPlaceholdersRef.current
      if (placeholderIds.length === 0) return

      const recordToPlaceholder = new Map<string, string>()
      results.forEach((r, i) => {
        if (i < placeholderIds.length)
          recordToPlaceholder.set(r.recordId, placeholderIds[i])
      })

      if (results.length < placeholderIds.length) {
        const extraIds = placeholderIds.slice(results.length)
        setImages((prev) => prev.filter((ci) => !extraIds.includes(ci.id)))
      }

      const pendingRecordIds = new Set(results.map((r) => r.recordId))

      const poll = async () => {
        if (pendingRecordIds.size === 0) {
          if (pollRef.current) clearInterval(pollRef.current)
          setIsGenerating(false)
          return
        }

        await checkPendingGenerations({
          data: { accessToken: accessToken! },
        }).catch(() => {})

        for (const recordId of [...pendingRecordIds]) {
          const { data: record } = await supabase
            .from('user_images')
            .select('id, status, storage_path')
            .eq('id', recordId)
            .single()

          if (!record) continue

          if (record.status === 'completed' && record.storage_path) {
            pendingRecordIds.delete(recordId)
            const placeholderId = recordToPlaceholder.get(recordId)
            if (!placeholderId) continue
            const signedUrl = await getSignedUrl(record.storage_path)
            if (signedUrl) {
              setImages((prev) =>
                prev.map((ci) =>
                  ci.id === placeholderId
                    ? {
                        ...ci,
                        recordId,
                        storagePath: record.storage_path,
                        signedUrl,
                        pending: false,
                      }
                    : ci,
                ),
              )
            } else {
              setImages((prev) => prev.filter((ci) => ci.id !== placeholderId))
            }
          } else if (record.status === 'failed') {
            pendingRecordIds.delete(recordId)
            const placeholderId = recordToPlaceholder.get(recordId)
            if (placeholderId)
              setImages((prev) => prev.filter((ci) => ci.id !== placeholderId))
          }
        }

        if (pendingRecordIds.size === 0) {
          if (pollRef.current) clearInterval(pollRef.current)
          setIsGenerating(false)
        }
      }

      pollRef.current = setInterval(poll, 5000)
      setTimeout(poll, 3000)
    },
    [accessToken, setImages],
  )

  const setLabel = useCallback((imageId: string, label: string) => {
    setLabels((prev) => ({ ...prev, [imageId]: label }))
  }, [])

  const adjustRuns = useCallback((delta: number) => {
    setRunsCount((prev) => Math.min(Math.max(prev + delta, 1), 2))
  }, [])

  const handleCombineOptimistic = useCallback(async () => {
    if (!accessToken || !prompt.trim() || sourceImages.length === 0) return

    const referenceImageIds = sourceImages.map((img) => img.recordId)

    // Build prompt with labels prepended if any are set
    const labeledParts = sourceImages
      .map((img, i) => {
        const label = labels[img.id]?.trim()
        return label ? `Image ${i + 1}: ${label}` : null
      })
      .filter(Boolean)
    const finalPrompt =
      labeledParts.length > 0
        ? `[${labeledParts.join(', ')}]\n\n${prompt.trim()}`
        : prompt.trim()

    const cost = CREDIT_COSTS.variation * runsCount
    if ((credits.balance ?? 0) < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    const bounds = getBounds(sourceImages)
    const ratio = parseRatio(aspectRatio)
    const placeholderH = bounds.h
    const placeholderW = Math.round(placeholderH * ratio)
    const gap = 40

    pushUndo()

    const placeholderIds: Array<string> = []
    const placeholders: Array<CanvasImage> = []
    for (let i = 0; i < runsCount; i++) {
      const id = crypto.randomUUID()
      placeholderIds.push(id)
      placeholders.push({
        id,
        recordId: '',
        storagePath: '',
        x: bounds.x + bounds.w + gap + i * (placeholderW + gap),
        y: bounds.y,
        width: placeholderW,
        height: placeholderH,
        pending: true,
      })
    }
    pendingPlaceholdersRef.current = placeholderIds
    setImages((prev) => [...prev, ...placeholders])
    setIsGenerating(true)
    setIsOpen(false)
    setError(null)

    try {
      const results = await Promise.allSettled(
        Array.from({ length: runsCount }, () =>
          generateImage({
            data: {
              prompt: finalPrompt,
              model: COMBINE_MODEL,
              accessToken: accessToken,
              aspectRatio,
              referenceImageIds,
            },
          }),
        ),
      )

      const fulfilled = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => ({
          recordId: (r as PromiseFulfilledResult<{ recordId: string }>).value
            .recordId,
        }))

      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) throw firstError.reason

      if (fulfilled.length > 0) handleAfterSubmit(fulfilled)
      await credits.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setImages((prev) => prev.filter((ci) => !placeholderIds.includes(ci.id)))
      setIsGenerating(false)
      if (message.includes('Insufficient credits')) {
        credits.showInsufficientCredits(cost)
      } else {
        setError(message)
        setIsOpen(true)
      }
    }
  }, [
    accessToken,
    prompt,
    sourceImages,
    labels,
    credits,
    runsCount,
    aspectRatio,
    pushUndo,
    setImages,
    handleAfterSubmit,
  ])

  const open = useCallback(async (images: Array<CanvasImage>) => {
    const withUrls = await Promise.all(
      images.map(async (img) => ({
        ...img,
        signedUrl:
          img.signedUrl ?? (await getSignedUrl(img.storagePath)) ?? undefined,
      })),
    )
    setSourceImages(withUrls)
    setLabels({})
    setPrompt('')
    setError(null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    open,
    close,
    sourceImages,
    labels,
    setLabel,
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    orientation,
    setOrientation,
    runsCount,
    adjustRuns,
    credits,
    error,
    isGenerating,
    handleCombineOptimistic,
  }
}
