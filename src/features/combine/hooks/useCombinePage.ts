import { useCallback, useState } from 'react'
import { combineImages } from '../server/combine-images.server'
import type { CollectedImage } from '@/features/describe/types'
import { useExistingImages } from '@/features/describe/hooks/useExistingImages'
import { useAuth } from '@/lib/auth'
import { saveGeneratedImage } from '@/features/describe/server/save-generated-image.server'
import { EDIT_MODELS } from '@/features/ai-images/models'

const DEFAULT_PROMPT =
  'Combine these images into a unique and creative layout that blends their elements harmoniously.'

interface SourceImage {
  id: string
  url: string
  title: string
}

interface CombineResult {
  url: string
  isSaving: boolean
  isSaved: boolean
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
  results: Array<CombineResult>
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
  saveResult: (index: number) => Promise<void>
}

export function useCombinePage(): UseCombinePageReturn {
  const { user, session } = useAuth()
  const [sourceImages, setSourceImages] = useState<Array<SourceImage>>([])
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [model, setModel] = useState(COMBINE_MODELS[0].id)
  const [results, setResults] = useState<Array<CombineResult>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const accessToken = session?.access_token
    if (!accessToken || !canCombine) return

    setIsGenerating(true)
    setError(null)

    try {
      // Convert blob URLs to data URLs for server
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

      setResults((prev) => [
        { url: result.imageUrl, isSaving: false, isSaved: false },
        ...prev,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to combine images')
    } finally {
      setIsGenerating(false)
    }
  }, [
    sourceImages,
    session?.access_token,
    canCombine,
    prompt,
    aspectRatio,
    model,
  ])

  const saveResult = useCallback(
    async (index: number) => {
      const accessToken = session?.access_token
      const result = results[index]
      if (!accessToken || result.isSaving || result.isSaved) return

      setResults((prev) =>
        prev.map((r, i) => (i === index ? { ...r, isSaving: true } : r)),
      )

      try {
        await saveGeneratedImage({
          data: {
            accessToken,
            imageUrl: result.url,
            prompt: 'Combine',
            model: model.replace(/\/edit$/, ''),
            aspectRatio,
          },
        })
        setResults((prev) =>
          prev.map((r, i) =>
            i === index ? { ...r, isSaving: false, isSaved: true } : r,
          ),
        )
      } catch (err) {
        console.error('Failed to save combined image:', err)
        setResults((prev) =>
          prev.map((r, i) => (i === index ? { ...r, isSaving: false } : r)),
        )
      }
    },
    [results, session?.access_token, model, aspectRatio],
  )

  return {
    sourceImages,
    prompt,
    orientation,
    aspectRatio,
    model,
    results,
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
    saveResult,
  }
}
