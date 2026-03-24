import { useCallback, useRef, useState } from 'react'
import { fileToDataUrl } from '../lib/persistence'
import type { CanvasImage } from '../types'
import { useGenerator } from '@/features/ai-images/hooks/use-generator'
import { useModelSelector } from '@/components/ModelSelector'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useUserImages } from '@/features/user-images'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

/** Parse "w:h" string into numeric ratio */
function parseRatio(r: string): number {
  const [w, h] = r.split(':').map(Number)
  return w && h ? w / h : 1
}

export function useCanvasGenerate(
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>,
  pushUndo: () => void,
) {
  const { session, user } = useAuth()
  const accessToken = session?.access_token
  const credits = useCredits()
  const userImages = useUserImages(user?.id)

  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const sourceRef = useRef<CanvasImage | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingPlaceholdersRef = useRef<Array<string>>([])

  const modelSelector = useModelSelector({
    capability: 'generate',
    mode: 'multi',
  })

  // When server returns record IDs, map them to already-created placeholders and start polling
  const handleAfterSubmit = useCallback(
    (results: Array<{ recordId: string }>) => {
      const placeholderIds = pendingPlaceholdersRef.current
      if (placeholderIds.length === 0) return

      const recordToPlaceholder = new Map<string, string>()
      results.forEach((r, i) => {
        if (i < placeholderIds.length) {
          recordToPlaceholder.set(r.recordId, placeholderIds[i])
        }
      })

      // Remove extra placeholders if server returned fewer results
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

            const { data: signedData } = await supabase.storage
              .from('user-images')
              .createSignedUrl(record.storage_path, 3600)

            if (signedData?.signedUrl) {
              try {
                const resp = await fetch(signedData.signedUrl)
                const blob = await resp.blob()
                const dataUrl = await fileToDataUrl(blob)

                setImages((prev) =>
                  prev.map((ci) =>
                    ci.id === placeholderId
                      ? { ...ci, src: dataUrl, pending: false }
                      : ci,
                  ),
                )
              } catch {
                setImages((prev) =>
                  prev.filter((ci) => ci.id !== placeholderId),
                )
              }
            }
          } else if (record.status === 'failed') {
            pendingRecordIds.delete(recordId)
            const placeholderId = recordToPlaceholder.get(recordId)
            if (placeholderId) {
              setImages((prev) => prev.filter((ci) => ci.id !== placeholderId))
            }
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

  const generator = useGenerator({
    accessToken,
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    credits,
    setError,
    storagePrefix: 'genzen-canvas',
    onAfterSubmit: handleAfterSubmit,
  })

  // Wrap handleGenerate to create placeholders optimistically before the server call
  const handleGenerateOptimistic = useCallback(() => {
    const source = sourceRef.current
    if (!source || !generator.canGenerate) return

    // Compute placeholder dimensions from aspect ratio
    const ratio = parseRatio(generator.aspectRatio)
    const placeholderH = source.height
    const placeholderW = Math.round(placeholderH * ratio)

    const totalCount =
      modelSelector.selectedIds.length * modelSelector.gensPerModel
    const gap = 40
    const startX = source.x + source.width + gap

    pushUndo()

    const placeholderIds: Array<string> = []
    const placeholders: Array<CanvasImage> = []
    for (let i = 0; i < totalCount; i++) {
      const id = crypto.randomUUID()
      placeholderIds.push(id)
      placeholders.push({
        id,
        src: '',
        x: startX + i * (placeholderW + gap),
        y: source.y,
        width: placeholderW,
        height: placeholderH,
        pending: true,
      })
    }
    pendingPlaceholdersRef.current = placeholderIds

    setImages((prev) => [...prev, ...placeholders])
    setIsGenerating(true)
    setIsOpen(false)

    // Fire the actual generation (async, non-blocking)
    generator.handleGenerate().catch(() => {
      // On total failure, remove all placeholders
      setImages((prev) => prev.filter((ci) => !placeholderIds.includes(ci.id)))
      setIsGenerating(false)
    })
  }, [generator, modelSelector, setImages, pushUndo])

  const open = useCallback(
    (sourceImage: CanvasImage) => {
      sourceRef.current = sourceImage
      setError(null)
      // Canvas images can be data URLs or remote URLs (e.g. pasted from web)
      if (sourceImage.src.startsWith('data:')) {
        generator.setSourceFromBase64(sourceImage.src, 'canvas-image')
      } else {
        generator.setSourceFromUrl(sourceImage.src, 'canvas-image')
      }
      setIsOpen(true)
    },
    [generator],
  )

  const close = useCallback(() => {
    setIsOpen(false)
    sourceRef.current = null
  }, [])

  return {
    isOpen,
    open,
    close,
    generator,
    modelSelector,
    credits,
    userImages,
    error,
    isGenerating,
    handleGenerateOptimistic,
  }
}
