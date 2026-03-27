import { useCallback, useMemo, useState } from 'react'

import type { SavedAiImage } from '@/features/ai-images/types'
import { CREDIT_COSTS } from '@/features/credits'
import { useAuth } from '@/lib/auth'
import { useRequireCredits } from '@/features/credits/hooks/use-require-credits'
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
  const credits = useRequireCredits(CREDIT_COSTS.image_gen)
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

  const [providerOverride, setProviderOverride] = useState<
    'fal' | 'google' | undefined
  >(() => {
    if (typeof window === 'undefined') return undefined
    const stored = localStorage.getItem('genzen:provider-override')
    return stored === 'fal' || stored === 'google' ? stored : undefined
  })

  const handleSetProviderOverride = useCallback(
    (value: 'fal' | 'google' | undefined) => {
      setProviderOverride(value)
      if (value) {
        localStorage.setItem('genzen:provider-override', value)
      } else {
        localStorage.removeItem('genzen:provider-override')
      }
    },
    [],
  )

  const generator = useGenerator({
    accessToken,
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    credits,
    setError,
    providerOverride,
  })

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  const parentIds = useMemo(
    () =>
      completedImages
        .filter((img) => img.generation_metadata?.generation_type !== 'edit')
        .map((img) => img.id),
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
    gallery.imageUrls,
  )

  const variations = useVariations({
    accessToken,
    credits,
    gallery,
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
    credits,
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
    providerOverride,
    setProviderOverride: handleSetProviderOverride,
  }
}
