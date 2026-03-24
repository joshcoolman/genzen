import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { captionImage } from '@/features/ai-images/server/caption-image.server'
import { CREDIT_COSTS } from '@/features/credits'
import {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  flipOrientation,
  getRatioOptions,
} from '@/features/ai-images/constants'
import { ALL_IMAGE_MODELS, EDIT_MODELS } from '@/features/ai-images/models'

// Kontext Dev is image-input only -- fall back to FLUX Dev for text-only
const KONTEXT_DEV = 'fal-ai/flux-kontext/dev'
const DRAFT_TEXT_ONLY_FALLBACK = 'fal-ai/flux/dev'

export interface RefImage {
  id: string
  url: string
  title: string
}

interface UseGeneratorOptions {
  accessToken: string | undefined
  selectedModels: Array<string>
  gensPerModel: number
  credits: CreditsState
  setError: (error: string | null) => void
  providerOverride?: 'fal' | 'google'
  storagePrefix?: string
  onAfterSubmit?: (results: Array<{ recordId: string }>) => void
}

export interface GeneratorState {
  prompt: string
  setPrompt: (prompt: string | ((prev: string) => string)) => void
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  setAspectRatio: (ratio: string) => void
  loading: boolean
  sourceImage: { base64: string; name: string } | null
  describingImage: boolean
  totalImages: number
  canGenerate: boolean
  ratioOptions: Array<string>
  selectedStyleId: string | null
  setSelectedStyleId: (id: string | null) => void
  setOrientation: (o: 'landscape' | 'portrait') => void
  handleOrientationToggle: () => void
  handleGenerate: () => Promise<void>
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string) => void
  setSourceFromBase64: (base64: string, name: string) => void
  handleClearSourceImage: () => void
  handleClear: () => void
  handleCaption: () => Promise<void>
  refImages: Array<RefImage>
  addRefImages: (images: Array<RefImage>) => void
  removeRefImage: (id: string) => void
  maxRefImages: number
}

export function useGenerator({
  accessToken,
  selectedModels,
  gensPerModel,
  credits,
  setError,
  providerOverride,
  storagePrefix = 'genzen',
  onAfterSubmit,
}: UseGeneratorOptions): GeneratorState {
  const promptKey = `${storagePrefix}:prompt`
  const orientationKey = `${storagePrefix}:orientation`
  const aspectRatioKey = `${storagePrefix}:aspect-ratio`

  const [prompt, setPromptRaw] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(promptKey) ?? ''
  })
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    () => {
      if (typeof window === 'undefined') return 'landscape'
      const stored = localStorage.getItem(orientationKey)
      return stored === 'portrait' ? 'portrait' : 'landscape'
    },
  )
  const [aspectRatio, setAspectRatio] = useState(() => {
    if (typeof window === 'undefined') return '16:9'
    return localStorage.getItem(aspectRatioKey) ?? '16:9'
  })
  const [loading, setLoading] = useState(false)
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
  } | null>(null)
  const [describingImage, setDescribingImage] = useState(false)
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [refImages, setRefImages] = useState<Array<RefImage>>([])

  // Wrap setPrompt to persist
  const setPrompt = useCallback(
    (value: string | ((prev: string) => string)) => {
      setPromptRaw((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        localStorage.setItem(promptKey, next)
        return next
      })
    },
    [],
  )

  // Persist orientation + aspect ratio on change
  useEffect(() => {
    localStorage.setItem(orientationKey, orientation)
  }, [orientation])

  useEffect(() => {
    localStorage.setItem(aspectRatioKey, aspectRatio)
  }, [aspectRatio])

  // Compute maxRefImages from selected models' edit endpoints
  const maxRefImages = useMemo(() => {
    const activeModelId = selectedModels[0]
    if (!activeModelId) return 0
    // Kontext Dev does img2img directly, no ref images
    if (activeModelId === KONTEXT_DEV) return 0
    const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === activeModelId)
    if (!modelDef?.supportsImageInput || !modelDef.imageInputModelId) return 0
    const editModel = EDIT_MODELS.find(
      (m) => m.id === modelDef.imageInputModelId,
    )
    return editModel?.maxRefImages ?? 0
  }, [selectedModels])

  const addRefImages = useCallback(
    (images: Array<RefImage>) => {
      setRefImages((prev) => {
        const existingIds = new Set(prev.map((r) => r.id))
        const newImages = images.filter((img) => !existingIds.has(img.id))
        return [...prev, ...newImages].slice(0, maxRefImages)
      })
    },
    [maxRefImages],
  )

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const totalImages = selectedModels.length * gensPerModel
  const canGenerate =
    (!!prompt.trim() || !!sourceImage) && selectedModels.length > 0

  const ratioOptions = getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    setOrientation(flipped.orientation)
    setAspectRatio(flipped.aspectRatio)
  }

  async function handleGenerate() {
    if (loading || !accessToken || !canGenerate) return

    const modelsToUse = selectedModels.flatMap((modelId) => {
      // Kontext Dev needs a source image -- fall back to FLUX Dev for text-only
      if (modelId === KONTEXT_DEV && !sourceImage) {
        return Array.from(
          { length: gensPerModel },
          () => DRAFT_TEXT_ONLY_FALLBACK,
        )
      }
      // If source image is present and model has an edit endpoint, use it
      if (sourceImage) {
        const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === modelId)
        if (modelDef?.imageInputModelId && modelId !== KONTEXT_DEV) {
          return Array.from(
            { length: gensPerModel },
            () => modelDef.imageInputModelId!,
          )
        }
      }
      return Array.from({ length: gensPerModel }, () => modelId)
    })
    const reason = sourceImage ? 'variation' : 'image_gen'
    const cost = CREDIT_COSTS[reason] * modelsToUse.length

    // Pre-flight credit check
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const finalPrompt = prompt.trim()
      const referenceImageIds =
        refImages.length > 0 ? refImages.map((r) => r.id) : undefined
      const results = await Promise.allSettled(
        modelsToUse.map((modelId) =>
          generateImage({
            data: {
              prompt: finalPrompt,
              model: modelId,
              accessToken: accessToken,
              aspectRatio,
              ...(sourceImage
                ? sourceImage.base64.startsWith('data:')
                  ? { sourceImageBase64: sourceImage.base64 }
                  : { sourceImageUrl: sourceImage.base64 }
                : {}),
              ...(selectedStyleId ? { styleId: selectedStyleId } : {}),
              ...(referenceImageIds ? { referenceImageIds } : {}),
              ...(providerOverride ? { providerOverride } : {}),
            },
          }),
        ),
      )
      const fulfilled = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => ({
          recordId: (r as PromiseFulfilledResult<{ recordId: string }>).value
            .recordId,
        }))
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) {
        throw firstError.reason
      }
      if (onAfterSubmit && fulfilled.length > 0) {
        onAfterSubmit(fulfilled)
      }
      // Refresh balance after server-side deduction
      await credits.refresh()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : String(err)
      if (message.includes('Insufficient credits')) {
        credits.showInsufficientCredits(cost)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  function applySourceBase64(base64: string, name: string) {
    setSourceImage({ base64, name })
    setPrompt('')

    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      if (!w || !h) return
      const ratio = w / h
      const isLandscape = ratio >= 1
      const nextOrientation = isLandscape ? 'landscape' : 'portrait'
      const candidates = isLandscape ? LANDSCAPE_RATIOS : PORTRAIT_RATIOS
      function parseRatio(r: string) {
        const [a, b] = r.split(':').map(Number)
        return a / b
      }
      const closest = candidates.reduce((best, r) =>
        Math.abs(parseRatio(r) - ratio) < Math.abs(parseRatio(best) - ratio)
          ? r
          : best,
      )
      setOrientation(nextOrientation)
      setAspectRatio(closest)
    }
    img.src = base64
  }

  const setSourceFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        applySourceBase64(base64, file.name)
      }
      reader.readAsDataURL(file)
    },
    [accessToken],
  )

  const setSourceFromUrl = useCallback(
    (url: string, name: string) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/png')
        applySourceBase64(base64, name)
      }
      img.src = url
    },
    [accessToken],
  )

  function handleClearSourceImage() {
    setSourceImage(null)
  }

  function handleClear() {
    setPrompt('')
    setSourceImage(null)
    setRefImages([])
  }

  const handleCaption = useCallback(async () => {
    if (!accessToken || !sourceImage || describingImage) return
    setDescribingImage(true)
    try {
      const { caption } = await captionImage({
        data: { imageBase64: sourceImage.base64, accessToken },
      })
      setPrompt((prev) => (prev ? `${caption}\n\n${prev}` : caption))
    } catch {
      // caption failed silently
    } finally {
      setDescribingImage(false)
    }
  }, [accessToken, sourceImage, describingImage])

  return {
    prompt,
    setPrompt,
    orientation,
    setOrientation,
    aspectRatio,
    setAspectRatio,
    loading,
    sourceImage,
    describingImage,
    totalImages,
    canGenerate,
    ratioOptions,
    selectedStyleId,
    setSelectedStyleId,
    handleOrientationToggle,
    handleGenerate,
    setSourceFile,
    setSourceFromUrl,
    setSourceFromBase64: applySourceBase64,
    handleClearSourceImage,
    handleClear,
    handleCaption,
    refImages,
    addRefImages,
    removeRefImage,
    maxRefImages,
  }
}
