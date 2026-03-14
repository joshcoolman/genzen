import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useImages } from '@/features/ai-images/hooks/use-images'
import { useModelSelector } from '@/components/ModelSelector'
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

  const modelSelector = useModelSelector({
    capability: 'generate',
    mode: 'multi',
  })

  // Active models: a subset of selectedIds that the pills control.
  // New models added via dropdown default to active.
  // Models removed from dropdown get cleaned out.
  const [activeModelIds, setActiveModelIds] = useState<Array<string>>(
    () => modelSelector.selectedIds,
  )

  const prevSelectedRef = useRef(modelSelector.selectedIds)
  useEffect(() => {
    const prev = prevSelectedRef.current
    const next = modelSelector.selectedIds
    prevSelectedRef.current = next

    setActiveModelIds((active) => {
      // Add any newly selected models as active
      const added = next.filter((id) => !prev.includes(id))
      // Remove any that were deselected from the dropdown
      const kept = active.filter((id) => next.includes(id))
      return [...kept, ...added]
    })
  }, [modelSelector.selectedIds])

  const toggleActiveModel = useCallback((modelId: string) => {
    setActiveModelIds((prev) => {
      if (prev.includes(modelId)) {
        if (prev.length === 1) return prev // keep at least one
        return prev.filter((id) => id !== modelId)
      }
      return [...prev, modelId]
    })
  }, [])

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    accessToken,
    selectedModels: activeModelIds,
    gensPerModel: modelSelector.gensPerModel,
    credits,
    setError,
  })

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  // Get IDs of completed non-edit images to fetch their edit children
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
    const { prompt, model: selectedModel } = img.generation_metadata
    generator.setPrompt(prompt)
    modelSelector.selectOnly([selectedModel])
  }

  return {
    accessToken,
    credits,
    gallery,
    userImages,
    modelSelector,
    activeModelIds,
    toggleActiveModel,
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
