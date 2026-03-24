import { useCallback, useRef, useState } from 'react'
import { getSignedUrl } from '../lib/persistence'
import type { CanvasImage } from '../types'
import { useGenerator } from '@/features/ai-images/hooks/use-generator'
import { useModelSelector } from '@/components/ModelSelector'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useUserImages } from '@/features/user-images'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { detectAspectRatio } from '@/features/ai-images/constants'

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

  // When server returns record IDs, map them to placeholders and poll for completion
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

  // Optimistic generation: create placeholders, then fire server call
  const handleGenerateOptimistic = useCallback(() => {
    const source = sourceRef.current
    if (!source || !generator.canGenerate) return

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
        recordId: '',
        storagePath: '',
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

    generator.handleGenerate().catch(() => {
      setImages((prev) => prev.filter((ci) => !placeholderIds.includes(ci.id)))
      setIsGenerating(false)
    })
  }, [generator, modelSelector, setImages, pushUndo])

  const open = useCallback(
    async (sourceImage: CanvasImage) => {
      sourceRef.current = sourceImage
      setError(null)

      // Source image has a Supabase record -- use its signed URL (CORS-safe)
      const url =
        sourceImage.signedUrl ?? (await getSignedUrl(sourceImage.storagePath))
      if (url) {
        generator.setSourceFromUrl(url, 'canvas-image')
      }

      // Set orientation + aspect ratio from canvas image dimensions
      const detected = detectAspectRatio(sourceImage.width, sourceImage.height)
      const isLandscape = sourceImage.width >= sourceImage.height
      generator.setOrientation(isLandscape ? 'landscape' : 'portrait')
      generator.setAspectRatio(detected)

      // Pre-fill prompt from generation_metadata
      if (sourceImage.recordId) {
        const { data: record } = await supabase
          .from('user_images')
          .select('generation_metadata')
          .eq('id', sourceImage.recordId)
          .single()

        const metadata = record?.generation_metadata as Record<
          string,
          unknown
        > | null
        const prompt = metadata?.prompt as string | undefined
        if (prompt) {
          generator.setPrompt(prompt)
        }
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
