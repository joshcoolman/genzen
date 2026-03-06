import { useCallback, useState } from 'react'
import { outpaintImage } from '../server/outpaint-image.server'
import type { SelectedImage } from '@/components/LibraryPickerButton'
import { useAuth } from '@/lib/auth'
import { detectAspectRatio } from '@/features/ai-images/constants'
import { saveGeneratedImage } from '@/features/describe/server/save-generated-image.server'
import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'user-images'

interface SourceImage {
  id: string
  url: string
  title: string
  storagePath?: string
}

interface OutpaintResult {
  url: string
  isSaving: boolean
  isSaved: boolean
}

export const OUTPAINT_MODELS = [
  {
    id: 'fal-ai/nano-banana-2/edit',
    name: 'Nano Banana 2',
    description: 'Reasoning-guided, best quality',
  },
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Pro',
    description: 'Realism + typography',
  },
  {
    id: 'fal-ai/gpt-image-1.5/edit',
    name: 'GPT Image 1.5',
    description: 'OpenAI, good baseline',
  },
]

export interface UseOutpaintPageReturn {
  sourceImage: SourceImage | null
  sourceNativeRatio: string | null
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  model: string
  results: Array<OutpaintResult>
  isGenerating: boolean
  error: string | null
  canOutpaint: boolean
  existingImages: {
    images: Array<{
      id: string
      title: string
      source: string
      storage_path: string
      [key: string]: unknown
    }>
    imageUrls: Record<string, string>
    isLoading: boolean
    refresh: () => Promise<void>
  }
  setOrientation: (o: 'landscape' | 'portrait') => void
  setAspectRatio: (ratio: string) => void
  setModel: (model: string) => void
  selectImage: (image: SelectedImage) => void
  selectFile: (file: File) => void
  outpaint: () => Promise<void>
  saveResult: (index: number) => Promise<void>
  reset: () => void
}

export function useOutpaintPage(): UseOutpaintPageReturn {
  const { user, session } = useAuth()
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [sourceNativeRatio, setSourceNativeRatio] = useState<string | null>(
    null,
  )
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [model, setModel] = useState(OUTPAINT_MODELS[0].id)
  const [results, setResults] = useState<Array<OutpaintResult>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Existing images for library picker
  const [images, setImages] = useState<
    Array<{
      id: string
      title: string
      source: string
      storage_path: string
      [key: string]: unknown
    }>
  >([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  const loadImageUrls = useCallback(
    async (imgs: Array<{ id: string; storage_path: string }>) => {
      for (const image of imgs) {
        const { data } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(image.storage_path, 3600)
        if (data) {
          setImageUrls((prev) => ({ ...prev, [image.id]: data.signedUrl }))
        }
      }
    },
    [],
  )

  const fetchImages = useCallback(async () => {
    if (!user?.id) return
    setIsLoadingImages(true)
    const { data } = await supabase
      .from('user_images')
      .select('*')
      .eq('user_id', user.id)
      .in('source', ['upload', 'ai_generated'])
      .order('created_at', { ascending: false })
    if (data) {
      setImages(data)
      if (data.length > 0) loadImageUrls(data)
    }
    setIsLoadingImages(false)
  }, [user?.id, loadImageUrls])

  const detectRatio = useCallback((url: string) => {
    const img = new Image()
    img.onload = () => {
      const ratio = detectAspectRatio(img.naturalWidth, img.naturalHeight)
      setSourceNativeRatio(ratio)
    }
    img.src = url
  }, [])

  const selectImage = useCallback(
    (image: SelectedImage) => {
      setSourceImage({
        id: image.id,
        url: image.url,
        title: image.title,
      })
      detectRatio(image.url)
      setError(null)
    },
    [detectRatio],
  )

  const selectFile = useCallback(
    (file: File) => {
      const objectUrl = URL.createObjectURL(file)
      setSourceImage({
        id: objectUrl,
        url: objectUrl,
        title: file.name,
      })
      detectRatio(objectUrl)
      setError(null)
    },
    [detectRatio],
  )

  const canOutpaint =
    !!sourceImage && !!sourceNativeRatio && aspectRatio !== sourceNativeRatio

  const outpaint = useCallback(async () => {
    const accessToken = session?.access_token
    if (!sourceImage || !accessToken || !canOutpaint) return

    setIsGenerating(true)
    setError(null)

    try {
      // If the source image URL is a signed Supabase URL, use it directly.
      // If it's an object URL (from file upload), we need to get the actual URL.
      let sourceUrl = sourceImage.url

      // For object URLs, we need to upload the file first or use a different approach.
      // Since the server needs a fetchable URL, for object URLs we read as data URL.
      if (sourceUrl.startsWith('blob:')) {
        const res = await fetch(sourceUrl)
        const blob = await res.blob()
        sourceUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(blob)
        })
      }

      const result = await outpaintImage({
        data: {
          accessToken,
          sourceImageUrl: sourceUrl,
          aspectRatio,
          model,
        },
      })

      setResults((prev) => [
        { url: result.imageUrl, isSaving: false, isSaved: false },
        ...prev,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to outpaint image')
    } finally {
      setIsGenerating(false)
    }
  }, [sourceImage, session?.access_token, canOutpaint, aspectRatio, model])

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
            prompt: 'Outpaint',
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
        console.error('Failed to save outpainted image:', err)
        setResults((prev) =>
          prev.map((r, i) => (i === index ? { ...r, isSaving: false } : r)),
        )
      }
    },
    [results, session?.access_token, model, aspectRatio],
  )

  const reset = useCallback(() => {
    setSourceImage(null)
    setSourceNativeRatio(null)
    setResults([])
    setError(null)
  }, [])

  return {
    sourceImage,
    sourceNativeRatio,
    orientation,
    aspectRatio,
    model,
    results,
    isGenerating,
    error,
    canOutpaint,
    existingImages: {
      images,
      imageUrls,
      isLoading: isLoadingImages,
      refresh: fetchImages,
    },
    setOrientation,
    setAspectRatio,
    setModel,
    selectImage,
    selectFile,
    outpaint,
    saveResult,
    reset,
  }
}
