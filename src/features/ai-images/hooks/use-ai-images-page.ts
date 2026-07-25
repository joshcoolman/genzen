import { useCallback, useMemo, useState } from 'react'

import type { SavedAiImage } from '@/features/ai-images/types'
import { useAuth } from '@/lib/auth'
import { useImages } from '@/features/ai-images/hooks/use-images'
import { useModelSelector } from '@/components/ModelSelector'
import { useGenerator } from '@/features/ai-images/hooks/use-generator'
import { useLightbox } from '@/features/ai-images/hooks/use-lightbox'
import { useVariations } from '@/features/ai-images/hooks/use-variations'
import { useEditChildren } from '@/features/ai-images/hooks/use-edit-children'
import { useReparent } from '@/features/ai-images/hooks/use-reparent'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { useDescribeJson } from '@/features/ai-images/hooks/use-describe-json'

export function useAiImagesPage() {
  const { user, session } = useAuth()
  const accessToken = session?.access_token

  const gallery = useImages({
    userId: user?.id,
    accessToken,
  })

  const userImages = useUserImages(user?.id)

  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
  })

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    accessToken,
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    setError,
  })

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  const parentIds = useMemo(
    () => completedImages.map((img) => img.id),
    [completedImages],
  )

  const editChildren = useEditChildren(parentIds, user?.id)
  const editChildrenMap = editChildren.map

  const reparent = useReparent({
    accessToken,
    onComplete: async () => {
      await gallery.refresh()
      editChildren.refresh()
    },
  })

  const lightbox = useLightbox(
    completedImages,
    gallery.deleteImage,
    editChildrenMap,
  )

  const variations = useVariations({
    accessToken,
    setError,
  })

  // Describe JSON for the generator's source image -- appends to prompt
  const sourceImageUrl = generator.sourceImage?.base64
  const describe = useDescribeJson({
    accessToken,
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
    userId: user?.id,
    accessToken,
    gallery,
    userImages,
    modelSelector,
    generator,
    editChildrenMap,
    refreshEditChildren: editChildren.refresh,
    reparent,
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
