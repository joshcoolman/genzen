import { useCallback, useRef, useState } from 'react'
import { canvasGenerate } from '../server/canvas-generate.server'
import { fileToDataUrl } from '../lib/persistence'
import type { CanvasImage } from '../types'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

interface VariationRequest {
  sourceImage: CanvasImage
  model: string
  aspectRatio?: string
  count: number
  prompt?: string
}

export function useCanvasVariations(
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>,
  pushUndo: () => void,
) {
  const { session } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const generateVariations = useCallback(
    async (req: VariationRequest) => {
      const accessToken = session?.access_token
      if (!accessToken) {
        setError('Not authenticated')
        return
      }

      setIsGenerating(true)
      setError(null)

      // Placeholder matches source image size — keeps canvas feeling consistent
      const placeholderW = req.sourceImage.width
      const placeholderH = req.sourceImage.height

      // Create placeholder images to the right of source
      const placeholderIds: Array<string> = []
      const gap = 40
      const startX = req.sourceImage.x + req.sourceImage.width + gap

      pushUndo()

      const placeholders: Array<CanvasImage> = []
      for (let i = 0; i < req.count; i++) {
        const id = crypto.randomUUID()
        placeholderIds.push(id)
        placeholders.push({
          id,
          src: '', // empty = pending placeholder
          x: startX + i * (placeholderW + gap),
          y: req.sourceImage.y,
          width: placeholderW,
          height: placeholderH,
          pending: true,
        })
      }

      setImages((prev) => [...prev, ...placeholders])

      try {
        const results = await canvasGenerate({
          data: {
            accessToken,
            imageDataUrl: req.sourceImage.src,
            prompt: req.prompt,
            model: req.model,
            aspectRatio: req.aspectRatio,
            count: req.count,
          },
        })

        // Map recordId -> placeholderId for replacement
        const recordToPlaceholder = new Map<string, string>()
        results.forEach(
          (r: { recordId: string; request_id?: string }, i: number) => {
            if (i < placeholderIds.length) {
              recordToPlaceholder.set(r.recordId, placeholderIds[i])
            }
          },
        )

        // Poll for completion
        const pendingRecordIds = new Set(
          results.map((r: { recordId: string }) => r.recordId),
        )

        const poll = async () => {
          if (pendingRecordIds.size === 0) {
            if (pollRef.current) clearInterval(pollRef.current)
            setIsGenerating(false)
            return
          }

          // Trigger server-side check
          await checkPendingGenerations({ data: { accessToken } }).catch(
            () => {},
          )

          // Check each pending record
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

              // Get signed URL and convert to data URL
              const { data: signedData } = await supabase.storage
                .from('user-images')
                .createSignedUrl(record.storage_path, 3600)

              if (signedData?.signedUrl) {
                try {
                  const resp = await fetch(signedData.signedUrl)
                  const blob = await resp.blob()
                  const dataUrl = await fileToDataUrl(blob)

                  // Keep placeholder dimensions — don't blow up to native res
                  setImages((prev) =>
                    prev.map((ci) =>
                      ci.id === placeholderId
                        ? { ...ci, src: dataUrl, pending: false }
                        : ci,
                    ),
                  )
                } catch {
                  // Remove failed placeholder
                  setImages((prev) =>
                    prev.filter((ci) => ci.id !== placeholderId),
                  )
                }
              }
            } else if (record.status === 'failed') {
              pendingRecordIds.delete(recordId)
              const placeholderId = recordToPlaceholder.get(recordId)
              if (placeholderId) {
                setImages((prev) =>
                  prev.filter((ci) => ci.id !== placeholderId),
                )
              }
            }
          }

          if (pendingRecordIds.size === 0) {
            if (pollRef.current) clearInterval(pollRef.current)
            setIsGenerating(false)
          }
        }

        // Poll every 5 seconds
        pollRef.current = setInterval(poll, 5000)
        // Initial check after a short delay
        setTimeout(poll, 3000)
      } catch (err) {
        // Remove all placeholders on error
        setImages((prev) =>
          prev.filter((ci) => !placeholderIds.includes(ci.id)),
        )
        setError(err instanceof Error ? err.message : 'Generation failed')
        setIsGenerating(false)
      }
    },
    [session, setImages, pushUndo],
  )

  return { generateVariations, isGenerating, error }
}
