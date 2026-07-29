'use client'

import { useCallback, useState } from 'react'

import type { SavedAiImage } from '#/features/ai-images/types'
import { useAuth } from '#/lib/auth'
import { useImages } from '#/features/ai-images/hooks/use-images'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useGenerator } from '#/features/ai-images/hooks/use-generator'
import { useLightbox } from '#/features/ai-images/hooks/use-lightbox'
import { useVariations } from '#/features/ai-images/hooks/use-variations'
import { useUserImages } from '#/features/user-images/hooks/useUserImages'
import { useDescribeJson } from '#/features/ai-images/hooks/use-describe-json'

export function useImagesPage() {
  const { user } = useAuth()

  const gallery = useImages({
    userId: user.id,
  })

  const userImages = useUserImages(user.id)

  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
  })

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    setError,
    // A submit inserts pending rows server-side. The gallery used to hear about
    // them on the realtime INSERT (#174); it now asks once the submits land,
    // and the 5s poll takes over from there until they settle.
    onAfterSubmit: () => {
      void gallery.refresh({ silent: true })
    },
  })

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  const lightbox = useLightbox(completedImages, gallery.deleteImage)

  const variations = useVariations({ setError })

  // Describe JSON for the generator's source image -- appends to prompt
  const sourceImageUrl = generator.sourceImage?.base64
  const describe = useDescribeJson({
    imageUrl: sourceImageUrl,
    onResult: useCallback(
      (json: string) => {
        generator.setPrompt((prev: string) =>
          prev ? `${prev}\n\n${json}` : json,
        )
      },
      [generator],
    ),
  })

  function handleLoadPrompt(img: SavedAiImage) {
    if (!img.generation_metadata?.prompt) return
    generator.setPrompt(img.generation_metadata.prompt)
  }

  function handleLoadPromptAndModel(img: SavedAiImage) {
    if (!img.generation_metadata) return
    const { prompt } = img.generation_metadata
    generator.setPrompt(prompt)
  }

  return {
    userId: user.id,
    gallery,
    userImages,
    modelSelector,
    generator,
    lightbox,
    variations,
    completedImages,
    error,
    setError,
    describe,
    handleLoadPrompt,
    handleLoadPromptAndModel,
  }
}
