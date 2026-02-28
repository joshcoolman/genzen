import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useImages } from '@/features/ai-images/hooks/use-images'
import { useModelSettings } from '@/features/ai-images/hooks/use-model-settings'
import { useGenerator } from '@/features/ai-images/hooks/use-generator'
import { useEditor } from '@/features/ai-images/hooks/use-editor'
import { useLightbox } from '@/features/ai-images/hooks/use-lightbox'
import { useVariations } from '@/features/ai-images/hooks/use-variations'
import { usePromptTools } from '@/features/ai-images/hooks/use-prompt-tools'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'

export function useAiImagesPage() {
  const { user, session } = useAuth()
  const credits = useCredits()
  const accessToken = session?.access_token

  const gallery = useImages({
    userId: user?.id,
    accessToken,
  })

  const modelSettings = useModelSettings()
  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    accessToken,
    selectedModels: modelSettings.selectedModels,
    credits,
    setError,
  })

  const editor = useEditor({
    accessToken,
    credits,
    defaultOrientation: generator.orientation,
    defaultAspectRatio: generator.aspectRatio,
    setError,
  })

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  const lightbox = useLightbox(completedImages)

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
    const { prompt, model: selectedModel } = img.generation_metadata
    generator.setPrompt(prompt)
    modelSettings.setSelectedModels([selectedModel])
    if (!modelSettings.visibleModelIds.includes(selectedModel)) {
      if (ALL_IMAGE_MODELS.some((m) => m.id === selectedModel)) {
        modelSettings.setVisibleModelIds((prev) => [...prev, selectedModel])
      }
    }
  }

  return {
    credits,
    gallery,
    modelSettings,
    generator,
    editor,
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
