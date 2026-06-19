import { useCallback, useMemo, useRef, useState } from 'react'
import { getSignedUrl, setOnCanvas } from '../lib/persistence'
import { CANVAS_EDIT_MODELS } from '../canvas-models'
import type { CanvasImage } from '../types'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { CREDIT_COSTS } from '@/features/credits'

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
  const [selectedModels, setSelectedModels] = useState<Array<string>>([
    CANVAS_EDIT_MODELS[0]?.id ?? '',
  ])

  // Each canvas edit model + whether it can handle the current selection size.
  // A model is disabled when the group has more images than its reference cap.
  const availableModels = useMemo(
    () =>
      CANVAS_EDIT_MODELS.map((m) => ({
        ...m,
        enabled:
          sourceImages.length === 0 || m.maxRefImages >= sourceImages.length,
      })),
    [sourceImages.length],
  )

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingPlaceholdersRef = useRef<Array<string>>([])
  const placeholderLayoutRef = useRef<{
    startX: number
    y: number
    placeholderW: number
    placeholderH: number
    gap: number
  } | null>(null)

  const handleAfterSubmit = useCallback(
    (results: Array<{ recordId: string }>) => {
      let placeholderIds = pendingPlaceholdersRef.current
      if (placeholderIds.length === 0) return

      // Reconcile placeholder count to the actual result count so none is dropped.
      if (results.length < placeholderIds.length) {
        const extraIds = placeholderIds.slice(results.length)
        setImages((prev) => prev.filter((ci) => !extraIds.includes(ci.id)))
        placeholderIds = placeholderIds.slice(0, results.length)
      } else if (results.length > placeholderIds.length) {
        const layout = placeholderLayoutRef.current
        const added: Array<string> = []
        const extra: Array<CanvasImage> = []
        for (let i = placeholderIds.length; i < results.length; i++) {
          const id = crypto.randomUUID()
          added.push(id)
          extra.push({
            id,
            recordId: '',
            storagePath: '',
            x: layout
              ? layout.startX + i * (layout.placeholderW + layout.gap)
              : 0,
            y: layout ? layout.y : 0,
            width: layout ? layout.placeholderW : 300,
            height: layout ? layout.placeholderH : 300,
            pending: true,
          })
        }
        setImages((prev) => [...prev, ...extra])
        placeholderIds = [...placeholderIds, ...added]
      }
      pendingPlaceholdersRef.current = placeholderIds

      const recordToPlaceholder = new Map<string, string>()
      results.forEach((r, i) => {
        if (i < placeholderIds.length)
          recordToPlaceholder.set(r.recordId, placeholderIds[i])
      })

      // Stamp the recordId onto each placeholder immediately so it persists to
      // IndexedDB and can be recovered on remount if the user navigates away
      // before the generation completes (recovery handled by useCanvasGenerate's
      // resumePending, which shares the same poll logic).
      setImages((prev) =>
        prev.map((ci) => {
          const idx = placeholderIds.indexOf(ci.id)
          if (idx >= 0 && idx < results.length) {
            return { ...ci, recordId: results[idx].recordId }
          }
          return ci
        }),
      )

      // Eagerly mark these rows on-canvas for DB-backed recovery.
      void setOnCanvas(
        results.map((r) => r.recordId),
        true,
      )

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
            const storagePath = record.storage_path
            const signedUrl = await getSignedUrl(storagePath)
            if (signedUrl) {
              setImages((prev) =>
                prev.map((ci) =>
                  ci.id === placeholderId
                    ? {
                        ...ci,
                        recordId,
                        storagePath,
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

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        if (prev.length === 1) return prev // keep at least one selected
        return prev.filter((id) => id !== modelId)
      }
      return [...prev, modelId]
    })
  }, [])

  const handleCombineOptimistic = useCallback(async () => {
    if (!accessToken || !prompt.trim() || sourceImages.length === 0) return

    const referenceImageIds = sourceImages.map((img) => img.recordId)

    // Every image gets a default identity ("Image N") so the model can always
    // be told which is which and the user can reference them by number without
    // labeling anything. A custom label augments the number ("Image N: trees").
    const labeledParts = sourceImages.map((img, i) => {
      const label = labels[img.id]?.trim()
      return label ? `Image ${i + 1}: ${label}` : `Image ${i + 1}`
    })
    const finalPrompt = `[${labeledParts.join(', ')}]\n\n${prompt.trim()}`

    const totalRuns = selectedModels.length * runsCount
    const cost = CREDIT_COSTS.variation * totalRuns
    if ((credits.balance ?? 0) < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    const bounds = getBounds(sourceImages)
    const ratio = parseRatio(aspectRatio)
    const placeholderH = bounds.h
    const placeholderW = Math.round(placeholderH * ratio)
    const gap = 40
    placeholderLayoutRef.current = {
      startX: bounds.x + bounds.w + gap,
      y: bounds.y,
      placeholderW,
      placeholderH,
      gap,
    }

    pushUndo()

    const placeholderIds: Array<string> = []
    const placeholders: Array<CanvasImage> = []
    for (let i = 0; i < totalRuns; i++) {
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

    let fulfilledCount = 0
    try {
      const results = await Promise.allSettled(
        selectedModels.flatMap((modelId) =>
          Array.from({ length: runsCount }, () =>
            generateImage({
              data: {
                prompt: finalPrompt,
                model: modelId,
                accessToken: accessToken,
                aspectRatio,
                referenceImageIds,
                onCanvas: true,
                sourceClient: 'genzen-canvas',
              },
            }),
          ),
        ),
      )

      const fulfilled = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => ({
          recordId: (r as PromiseFulfilledResult<{ recordId: string }>).value
            .recordId,
        }))

      // Process successful submits BEFORE surfacing a partial failure, so the
      // generations that went through still get stamped, persisted, and polled.
      fulfilledCount = fulfilled.length
      if (fulfilled.length > 0) handleAfterSubmit(fulfilled)

      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) throw firstError.reason

      await credits.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Remove only placeholders that never got a record (true failures); the
      // stamped ones from a partial success are being polled to completion.
      setImages((prev) =>
        prev.filter((ci) => !(placeholderIds.includes(ci.id) && !ci.recordId)),
      )
      if (fulfilledCount === 0) setIsGenerating(false)
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
    selectedModels,
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
    // Keep any currently-selected models that still fit this group; otherwise
    // default to the first model whose reference cap can hold the selection.
    const enabledIds = new Set(
      CANVAS_EDIT_MODELS.filter((m) => m.maxRefImages >= images.length).map(
        (m) => m.id,
      ),
    )
    setSelectedModels((prev) => {
      const kept = prev.filter((id) => enabledIds.has(id))
      if (kept.length > 0) return kept
      const firstEnabled = CANVAS_EDIT_MODELS.find((m) => enabledIds.has(m.id))
      return firstEnabled ? [firstEnabled.id] : []
    })
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
    selectedModels,
    availableModels,
    toggleModel,
    credits,
    error,
    isGenerating,
    handleCombineOptimistic,
  }
}
