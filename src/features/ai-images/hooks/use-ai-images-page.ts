import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { SlotTier } from '@/lib/model-slots'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useImages } from '@/features/ai-images/hooks/use-images'
import { useModelSlots } from '@/lib/model-slots'
import { useGenerator } from '@/features/ai-images/hooks/use-generator'
import { useLightbox } from '@/features/ai-images/hooks/use-lightbox'
import { useVariations } from '@/features/ai-images/hooks/use-variations'
import { usePromptTools } from '@/features/ai-images/hooks/use-prompt-tools'
import { useEditChildren } from '@/features/ai-images/hooks/use-edit-children'
import { useReparent } from '@/features/ai-images/hooks/use-reparent'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { useDescribeJson } from '@/features/ai-images/hooks/use-describe-json'

const GENS_STORAGE_KEY = 'genzen:slot-gens-per-model'

export function useAiImagesPage() {
  const { user, session } = useAuth()
  const credits = useCredits()
  const accessToken = session?.access_token

  const gallery = useImages({
    userId: user?.id,
    accessToken,
  })

  const userImages = useUserImages(user?.id)

  const { slots } = useModelSlots()
  const [activeTier, setActiveTier] = useState<SlotTier>('draft')
  const [gensPerModel, setGensPerModel] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    try {
      const stored = localStorage.getItem(GENS_STORAGE_KEY)
      return stored ? Math.max(1, Math.min(5, Number(stored))) : 1
    } catch {
      return 1
    }
  })

  useEffect(() => {
    localStorage.setItem(GENS_STORAGE_KEY, String(gensPerModel))
  }, [gensPerModel])

  const adjustGens = useCallback((delta: number) => {
    setGensPerModel((prev) => Math.min(Math.max(prev + delta, 1), 5))
  }, [])

  const activeModelId = slots[activeTier]

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    accessToken,
    selectedModels: [activeModelId],
    gensPerModel,
    credits,
    setError,
    activeTier,
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

  const lightbox = useLightbox(completedImages, gallery.deleteImage)

  const variations = useVariations({
    accessToken,
    credits,
    gallery,
    setError,
  })

  // Describe JSON for the currently selected lightbox image
  const lightboxImage =
    lightbox.index !== null ? completedImages[lightbox.index] : null
  const lightboxImageUrl = lightboxImage
    ? gallery.imageUrls[lightboxImage.id]
    : undefined
  const describe = useDescribeJson({
    accessToken,
    imageUrl: lightboxImageUrl,
  })

  const promptTools = usePromptTools({
    accessToken,
    setPrompt: generator.setPrompt,
    getPrompt: () => generator.prompt,
    setError,
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
    accessToken,
    credits,
    gallery,
    userImages,
    slots,
    activeTier,
    setActiveTier,
    activeModelId,
    gensPerModel,
    adjustGens,
    generator,
    editChildrenMap,
    reparent,
    lightbox,
    variations,
    promptTools,
    completedImages,
    error,
    setError,
    describe,
    handleLoadPrompt,
    handleLoadPromptAndModel,
  }
}
