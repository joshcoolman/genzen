'use client'

import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { generateVariationPrompts } from '@/features/ai-images/server/generate-variation-prompts.server'

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
    setSourceFn?: (url: string, name: string) => void,
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
    setSourceFn?: (url: string, name: string) => void,
  ) {
    if (sourceImageUrl && setSourceFn && pendingSourceImage) {
      void setSourceFn(sourceImageUrl, pendingSourceImage.id)
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
