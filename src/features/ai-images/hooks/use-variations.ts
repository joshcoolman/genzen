import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import type { GalleryState } from '@/features/ai-images/hooks/use-images'
import { generateVariationPrompts } from '@/features/ai-images/server/generate-variation-prompts.server'
import { submitVariations } from '@/features/ai-images/server/submit-variations.server'
import { CREDIT_COSTS } from '@/features/credits'

interface UseVariationsOptions {
  accessToken: string | undefined
  credits: CreditsState
  gallery: GalleryState
  setError: (error: string | null) => void
}

export interface PendingVariation {
  sourceImage: SavedAiImage
  prompts: Array<string>
  rootPrompt: string
  rootImageId: string
  sourceImageId: string
  falImageUrl?: string
}

export interface VariationsState {
  generatingVariationFor: string | null
  generatingPrompts: boolean
  submittingVariations: boolean
  pendingVariation: PendingVariation | null
  handlePreviewVariations: (img: SavedAiImage, count: number) => Promise<void>
  handleRunVariations: (prompts: Array<string>) => Promise<void>
  cancelVariationPreview: () => void
  handleMoreLikeThis: (img: SavedAiImage, count: number) => Promise<void>
}

export function useVariations({
  accessToken,
  credits,
  gallery,
  setError,
}: UseVariationsOptions): VariationsState {
  const [generatingVariationFor, setGeneratingVariationFor] = useState<
    string | null
  >(null)
  const [generatingPrompts, setGeneratingPrompts] = useState(false)
  const [submittingVariations, setSubmittingVariations] = useState(false)
  const [pendingVariation, setPendingVariation] =
    useState<PendingVariation | null>(null)

  async function handlePreviewVariations(img: SavedAiImage, count: number) {
    if (
      !accessToken ||
      !img.generation_metadata?.prompt ||
      !img.generation_metadata.model
    )
      return

    setError(null)
    setGeneratingPrompts(true)
    setPendingVariation({
      sourceImage: img,
      prompts: [],
      rootPrompt: '',
      rootImageId: '',
      sourceImageId: img.id,
    })

    try {
      const result = await generateVariationPrompts({
        data: {
          accessToken,
          prompt: img.generation_metadata.prompt,
          sourceImageId: img.id,
          count,
        },
      })

      setPendingVariation({
        sourceImage: img,
        prompts: result.prompts,
        rootPrompt: result.rootPrompt,
        rootImageId: result.rootImageId,
        sourceImageId: result.sourceImageId,
        falImageUrl: result.falImageUrl,
      })
    } catch (err) {
      setPendingVariation(null)
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setGeneratingPrompts(false)
    }
  }

  async function handleRunVariations(prompts: Array<string>) {
    if (!accessToken || !pendingVariation) return

    const img = pendingVariation.sourceImage
    const cost = CREDIT_COSTS.variation * prompts.length

    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setError(null)
    setSubmittingVariations(true)
    setGeneratingVariationFor(img.id)

    const optimisticIds = prompts.map((_, i) => `optimistic-${img.id}-${i}`)
    for (const optimisticId of optimisticIds) {
      gallery.addOptimisticCard({
        id: optimisticId,
        title: 'Generating variation...',
        storage_path: null,
        created_at: new Date(
          new Date(img.created_at).getTime() + 1000,
        ).toISOString(),
        status: 'pending',
        generation_error: null,
        generation_metadata: {
          prompt: img.generation_metadata?.prompt ?? '',
          model: img.generation_metadata?.model ?? '',
          generation_type: 'variation',
          source_image_id: img.id,
          aspect_ratio: img.generation_metadata?.aspect_ratio,
        },
      })
    }

    // Close dialog immediately
    setPendingVariation(null)

    try {
      const results = await submitVariations({
        data: {
          accessToken,
          prompts,
          model: img.generation_metadata?.model ?? '',
          sourceImageId: pendingVariation.sourceImageId,
          rootImageId: pendingVariation.rootImageId,
          rootPrompt: pendingVariation.rootPrompt,
          aspectRatio: img.generation_metadata?.aspect_ratio,
          falImageUrl: pendingVariation.falImageUrl,
        },
      })

      for (let i = 0; i < results.length; i++) {
        const realCard: SavedAiImage = {
          id: results[i].recordId,
          title: 'Generating variation...',
          storage_path: null,
          created_at: new Date(
            new Date(img.created_at).getTime() + 1000,
          ).toISOString(),
          status: 'pending',
          generation_error: null,
          generation_metadata: {
            prompt: prompts[i],
            model: img.generation_metadata?.model ?? '',
            aspect_ratio: img.generation_metadata?.aspect_ratio,
          },
        }
        gallery.replaceOptimisticCard(optimisticIds[i], realCard)
      }
      for (let i = results.length; i < optimisticIds.length; i++) {
        gallery.removeOptimisticCard(optimisticIds[i])
      }
      await credits.refresh()
    } catch (err) {
      for (const optimisticId of optimisticIds) {
        gallery.removeOptimisticCard(optimisticId)
      }
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Insufficient credits')) {
        credits.showInsufficientCredits(cost)
      } else {
        setError(message)
      }
    } finally {
      setGeneratingVariationFor(null)
      setSubmittingVariations(false)
    }
  }

  function cancelVariationPreview() {
    setPendingVariation(null)
  }

  // Legacy: direct generation without preview (kept for backward compat)
  async function handleMoreLikeThis(img: SavedAiImage, count: number) {
    await handlePreviewVariations(img, count)
  }

  return {
    generatingVariationFor,
    generatingPrompts,
    submittingVariations,
    pendingVariation,
    handlePreviewVariations,
    handleRunVariations,
    cancelVariationPreview,
    handleMoreLikeThis,
  }
}
