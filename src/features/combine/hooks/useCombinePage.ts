import { useCallback, useState } from 'react'
import { combineImages } from '../server/combine-images.server'
import type { CollectedImage } from '@/features/user-images/types'
import type { GenerationResult } from '@/lib/types/generation-result'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { useAuth } from '@/lib/auth'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { EDIT_MODELS, getModelName } from '@/features/ai-images/models'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { isCreditError } from '@/features/credits/handle-credit-error'

const DEFAULT_PROMPT =
  'Combine these images into a unique and creative layout that blends their elements harmoniously.'

interface SourceImage {
  id: string
  url: string
  title: string
}

export const COMBINE_MODELS = EDIT_MODELS.map((m) => ({
  id: m.id,
  name: m.name,
  description: m.description,
}))

export interface UseCombinePageReturn {
  sourceImages: Array<SourceImage>
  prompt: string
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  model: string
  recentResults: Array<GenerationResult>
  isGenerating: boolean
  error: string | null
  canCombine: boolean
  existingImages: ReturnType<typeof useExistingImages>
  libraryPickerOpen: boolean
  setLibraryPickerOpen: (open: boolean) => void
  openLibraryPicker: () => void
  handleLibraryConfirm: (images: Array<CollectedImage>) => void
  setPrompt: (prompt: string) => void
  setOrientation: (o: 'landscape' | 'portrait') => void
  setAspectRatio: (ratio: string) => void
  setModel: (model: string) => void
  addFile: (file: File) => void
  removeImage: (id: string) => void
  combine: () => Promise<void>
  deleteResult: (id: string) => Promise<void>
}

export function useCombinePage(): UseCombinePageReturn {
  const { user, session } = useAuth()
  const credits = useCredits()
  const accessToken = session?.access_token ?? ''
  const [sourceImages, setSourceImages] = useState<Array<SourceImage>>([])
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [model, setModel] = useState(COMBINE_MODELS[0].id)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    results: recentResults,
    addPendingResult,
    replaceTempId,
    deleteResult,
  } = useGenerationResults({
    userId: user?.id,
    accessToken,
    generationType: 'combine',
  })

  const existingImages = useExistingImages(user?.id)

  // Library picker state
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)

  const openLibraryPicker = useCallback(() => {
    existingImages.refresh()
    setLibraryPickerOpen(true)
  }, [existingImages])

  const handleLibraryConfirm = useCallback(
    (selected: Array<CollectedImage>) => {
      setSourceImages((prev) => {
        const existingIds = new Set(prev.map((i) => i.id))
        const newImages = selected
          .filter((img) => !existingIds.has(img.id))
          .map((img) => ({ id: img.id, url: img.url, title: img.title }))
        return [...prev, ...newImages]
      })
      setError(null)
    },
    [],
  )

  const addFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setSourceImages((prev) => [
      ...prev,
      { id: objectUrl, url: objectUrl, title: file.name },
    ])
    setError(null)
  }, [])

  const removeImage = useCallback((id: string) => {
    setSourceImages((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const canCombine = sourceImages.length >= 2 && prompt.trim().length > 0

  const combine = useCallback(async () => {
    if (!accessToken || !canCombine) return

    const cost = CREDIT_COSTS.image_gen
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setIsGenerating(true)
    setError(null)

    const tempId = `temp-combine-${Date.now()}`
    addPendingResult({
      id: tempId,
      status: 'pending',
      label: getModelName(model),
      prompt,
    })

    try {
      const sourceUrls = await Promise.all(
        sourceImages.map(async (img) => {
          if (img.url.startsWith('blob:')) {
            const res = await fetch(img.url)
            const blob = await res.blob()
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => reject(new Error('Failed to read file'))
              reader.readAsDataURL(blob)
            })
          }
          return img.url
        }),
      )

      const result = await combineImages({
        data: {
          accessToken,
          sourceImageUrls: sourceUrls,
          prompt,
          aspectRatio,
          model,
        },
      })

      replaceTempId(tempId, result.recordId)
    } catch (err) {
      if (isCreditError(err)) {
        credits.showInsufficientCredits(cost)
      } else {
        setError(
          err instanceof Error ? err.message : 'Failed to combine images',
        )
      }
    } finally {
      setIsGenerating(false)
    }
  }, [
    sourceImages,
    accessToken,
    canCombine,
    prompt,
    aspectRatio,
    model,
    credits,
    addPendingResult,
    replaceTempId,
  ])

  return {
    sourceImages,
    prompt,
    orientation,
    aspectRatio,
    model,
    recentResults,
    isGenerating,
    error,
    canCombine,
    existingImages,
    libraryPickerOpen,
    setLibraryPickerOpen,
    openLibraryPicker,
    handleLibraryConfirm,
    setPrompt,
    setOrientation,
    setAspectRatio,
    setModel,
    addFile,
    removeImage,
    combine,
    deleteResult,
  }
}
