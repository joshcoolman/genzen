'use client'

import { useState } from 'react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { generateVariationPrompts } from '#/features/ai-images/server/generate-variation-prompts.action'

interface UseVariationsOptions {
  setError: (error: string | null) => void
}

export interface VariationsState {
  variationDialogOpen: boolean
  pendingSourceImage: SavedAiImage | null
  variationPrompts: Array<string>
  generatingPrompts: boolean
  openVariationDialog: (img: SavedAiImage) => void
  handlePreviewVariations: (guidance: string, count: number) => Promise<void>
  handleApplyVariations: (
    prompts: Array<string>,
    applyFn: (prompts: Array<string>) => void,
    sourceImageUrl?: string,
    setPrimaryFn?: (image: { id: string; url: string; title: string }) => void,
  ) => void
  cancelVariationPreview: () => void
}

export function useVariations({
  setError,
}: UseVariationsOptions): VariationsState {
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [pendingSourceImage, setPendingSourceImage] =
    useState<SavedAiImage | null>(null)
  const [variationPrompts, setVariationPrompts] = useState<Array<string>>([])
  const [generatingPrompts, setGeneratingPrompts] = useState(false)

  function openVariationDialog(img: SavedAiImage) {
    setPendingSourceImage(img)
    setVariationPrompts([])
    setVariationDialogOpen(true)
  }

  async function handlePreviewVariations(guidance: string, count: number) {
    if (!pendingSourceImage || !pendingSourceImage.generation_metadata?.prompt)
      return

    setError(null)
    setGeneratingPrompts(true)

    try {
      const result = await generateVariationPrompts({
        prompt: pendingSourceImage.generation_metadata.prompt,
        sourceImageId: pendingSourceImage.id,
        count,
        ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
      })
      setVariationPrompts(result.prompts)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setVariationDialogOpen(false)
    } finally {
      setGeneratingPrompts(false)
    }
  }

  function handleApplyVariations(
    prompts: Array<string>,
    applyFn: (prompts: Array<string>) => void,
    sourceImageUrl?: string,
    setPrimaryFn?: (image: { id: string; url: string; title: string }) => void,
  ) {
    if (sourceImageUrl && setPrimaryFn && pendingSourceImage) {
      // The image the variations are of goes into slot 0 of the set (#297).
      // It carries its library id, so Retry can send it again (#214).
      setPrimaryFn({
        id: pendingSourceImage.id,
        url: sourceImageUrl,
        title: pendingSourceImage.title || pendingSourceImage.id,
      })
    }
    applyFn(prompts)
    cancelVariationPreview()
  }

  function cancelVariationPreview() {
    setVariationDialogOpen(false)
    setPendingSourceImage(null)
    setVariationPrompts([])
  }

  return {
    variationDialogOpen,
    pendingSourceImage,
    variationPrompts,
    generatingPrompts,
    openVariationDialog,
    handlePreviewVariations,
    handleApplyVariations,
    cancelVariationPreview,
  }
}
