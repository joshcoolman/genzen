import { useMemo, useState  } from 'react'
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
import { useUserImages } from '@/features/user-images/hooks/useUserImages'

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

  const activeModelId = slots[activeTier]

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    accessToken,
    selectedModels: [activeModelId],
    gensPerModel: 1,
    credits,
    setError,
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

  const editChildrenMap = useEditChildren(parentIds, user?.id)

  const lightbox = useLightbox(completedImages, gallery.deleteImage)

  const variations = useVariations({
    accessToken,
    credits,
    gallery,
    setError,
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
    generator,
    editChildrenMap,
    lightbox,
    variations,
    promptTools,
    completedImages,
    error,
    setError,
    handleLoadPrompt,
    handleLoadPromptAndModel,
  }
}
