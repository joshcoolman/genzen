import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import type { GalleryState } from '@/features/ai-images/hooks/use-images'
import { generateVariation } from '@/features/ai-images/server/generate-variation.server'
import { CREDIT_COSTS } from '@/features/credits'

interface UseVariationsOptions {
  accessToken: string | undefined
  credits: CreditsState
  gallery: GalleryState
  setError: (error: string | null) => void
}

export interface VariationsState {
  generatingVariationFor: string | null
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

  async function handleMoreLikeThis(img: SavedAiImage, count: number) {
    if (
      !accessToken ||
      !img.generation_metadata?.prompt ||
      !img.generation_metadata.model
    )
      return

    setError(null)
    setGeneratingVariationFor(img.id)

    const optimisticIds = Array.from(
      { length: count },
      (_, i) => `optimistic-${img.id}-${i}`,
    )
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
          prompt: img.generation_metadata.prompt,
          model: img.generation_metadata.model,
          generation_type: 'variation',
          source_image_id: img.id,
        },
      })
    }

    try {
      await credits.deduct(CREDIT_COSTS.variation * count, 'variation')
      const results = await generateVariation({
        data: {
          accessToken,
          prompt: img.generation_metadata.prompt,
          model: img.generation_metadata.model,
          sourceImageId: img.id,
          count,
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
            prompt: img.generation_metadata.prompt,
            model: img.generation_metadata.model,
          },
        }
        gallery.replaceOptimisticCard(optimisticIds[i], realCard)
      }
      for (let i = results.length; i < optimisticIds.length; i++) {
        gallery.removeOptimisticCard(optimisticIds[i])
      }
    } catch (err) {
      for (const optimisticId of optimisticIds) {
        gallery.removeOptimisticCard(optimisticId)
      }
      setError(
        err instanceof Error ? err.message : 'Failed to generate variations',
      )
    } finally {
      setGeneratingVariationFor(null)
    }
  }

  return {
    generatingVariationFor,
    handleMoreLikeThis,
  }
}
