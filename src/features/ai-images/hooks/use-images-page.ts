'use client'

import { useCallback, useMemo, useState } from 'react'

import type { SavedAiImage } from '#/features/ai-images/types'
import { useAuth } from '#/lib/auth'
import { getR2PublicUrl } from '#/lib/image-storage'
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

  // The highlight (#205). A highlighted image is the primary reference for
  // whatever you prompt next; clicking it again takes the highlight off and
  // you are back to plain generation. This replaced the /edit route, which
  // answered "which image is the source" -- state wearing a URL as a costume.
  //
  // It is one flag. The generator already knows what to do with a source
  // image, including picking the model's image-input endpoint, so "edit" vs
  // "generate" stays a detail of building the request.
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)

  const clearHighlight = useCallback(() => {
    setSelectedImageId(null)
    generator.handleClearSourceImage()
  }, [generator])

  const toggleHighlight = useCallback(
    (img: SavedAiImage) => {
      if (img.id === selectedImageId) {
        clearHighlight()
        return
      }
      if (!img.storage_path) return
      setSelectedImageId(img.id)
      // A public URL, not base64: the generator forwards a non-`data:` source
      // to the server as `sourceImageUrl`.
      generator.setSourceFromBase64(getR2PublicUrl(img.storage_path), img.title)
    },
    [selectedImageId, clearHighlight, generator],
  )

  // The panel's own clear button has to take the highlight with it, or the
  // border would outlive the reference it stands for.
  const generatorWithHighlight = useMemo(
    () => ({ ...generator, handleClearSourceImage: clearHighlight }),
    [generator, clearHighlight],
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
    generator: generatorWithHighlight,
    selectedImageId,
    toggleHighlight,
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
