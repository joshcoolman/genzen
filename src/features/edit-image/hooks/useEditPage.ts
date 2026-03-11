import { useCallback, useState } from 'react'
import { useEditSourceImage } from './useEditSourceImage'
import { useEditModels } from './useEditModels'
import { useEditResults } from './useEditResults'
import type { CollectedImage } from '@/features/user-images/types'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { useAuth } from '@/lib/auth'

export function useEditPage() {
  const { user, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const sourceImage = useEditSourceImage(user?.id)
  const editModels = useEditModels()
  const results = useEditResults({ userId: user?.id, accessToken })
  const existingImages = useExistingImages(user?.id)

  const [prompt, setPrompt] = useState('')
  const [refImages, setRefImages] = useState<Array<CollectedImage>>([])
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  const handleSourceFile = useCallback(
    (file: File) => {
      void sourceImage.setSourceFile(file)
    },
    [sourceImage],
  )

  const openRefPicker = useCallback(() => {
    existingImages.refresh()
    setRefPickerOpen(true)
  }, [existingImages])

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const handleRefImagesConfirm = useCallback(
    (images: Array<CollectedImage>) => {
      setRefImages((prev) => {
        const existingIds = new Set(prev.map((img) => img.id))
        const newImages = images.filter((img) => !existingIds.has(img.id))
        const combined = [...prev, ...newImages]
        return combined.slice(0, editModels.maxRefImages)
      })
    },
    [editModels.maxRefImages],
  )

  const handleGenerate = useCallback(() => {
    if (!sourceImage.sourceImage) return

    void results.submit({
      accessToken,
      sourceImageId: sourceImage.sourceImage.id,
      editPrompt: prompt,
      aspectRatio: sourceImage.aspectRatio,
      referenceImageIds: refImages.map((img) => img.id),
      modelIds: editModels.selectedModelIds,
      generationsPerModel: editModels.generationsPerModel,
    })
  }, [
    accessToken,
    sourceImage.sourceImage,
    sourceImage.aspectRatio,
    prompt,
    refImages,
    editModels.selectedModelIds,
    editModels.generationsPerModel,
    results,
  ])

  // Prune ref images if maxRefImages decreases
  const cappedRefImages = refImages.slice(0, editModels.maxRefImages)

  return {
    sourceImage,
    editModels,
    results,
    existingImages,
    prompt,
    setPrompt,
    refImages: cappedRefImages,
    refPickerOpen,
    setRefPickerOpen,
    handleSourceFile,
    openRefPicker,
    removeRefImage,
    handleRefImagesConfirm,
    handleGenerate,
  }
}

export type UseEditPageReturn = ReturnType<typeof useEditPage>
