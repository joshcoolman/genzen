import { useCallback, useState } from 'react'
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

interface UseGeneratorOptions {
  accessToken: string | undefined
  selectedModels: Array<string>
  credits: CreditsState
  setError: (error: string | null) => void
}

export interface GeneratorState {
  prompt: string
  setPrompt: (prompt: string) => void
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  setAspectRatio: (ratio: string) => void
  loading: boolean
  sourceImage: { base64: string; name: string } | null
  imageSelectedModels: Array<string>
  describingImage: boolean
  inputMode: 'image' | 'text'
  activeModels: Array<string>
  canGenerate: boolean
  ratioOptions: Array<string>
  setOrientation: (o: 'landscape' | 'portrait') => void
  handleOrientationToggle: () => void
  handleGenerate: () => Promise<void>
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string) => void
  handleClearSourceImage: () => void
  toggleImageModel: (modelId: string, checked: boolean) => void
}

export function useGenerator({
  accessToken,
  selectedModels,
  credits,
  setError,
}: UseGeneratorOptions): GeneratorState {
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [loading, setLoading] = useState(false)
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
  } | null>(null)
  const [imageSelectedModels, setImageSelectedModels] = useState<Array<string>>(
    [],
  )
  const [describingImage, setDescribingImage] = useState(false)

  const inputMode = sourceImage ? 'image' : 'text'
  const activeModels =
    inputMode === 'image' ? imageSelectedModels : selectedModels
  const canGenerate =
    inputMode === 'image'
      ? imageSelectedModels.length > 0
      : !!prompt.trim() && selectedModels.length > 0

  const ratioOptions = getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    setOrientation(flipped.orientation)
    setAspectRatio(flipped.aspectRatio)
  }

  function toggleImageModel(modelId: string, checked: boolean) {
    if (checked) {
      setImageSelectedModels((prev) => [...prev, modelId])
    } else {
      setImageSelectedModels((prev) => prev.filter((id) => id !== modelId))
    }
  }

  async function handleGenerate() {
    if (loading || !accessToken || !canGenerate) return

    const modelsToUse = activeModels
    const reason = sourceImage ? 'variation' : 'image_gen'
    const cost = CREDIT_COSTS[reason] * modelsToUse.length

    // Pre-flight credit check
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost, () => void handleGenerate())
      return
    }

    setLoading(true)
    setError(null)

    try {
      const finalPrompt = prompt.trim()
      const results = await Promise.allSettled(
        modelsToUse.map((modelId) =>
          generateImage({
            data: {
              prompt: finalPrompt,
              model: modelId,
              accessToken: accessToken,
              aspectRatio,
              ...(sourceImage ? { sourceImageBase64: sourceImage.base64 } : {}),
            },
          }),
        ),
      )
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) {
        throw firstError.reason
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
        credits.showInsufficientCredits(cost, () => void handleGenerate())
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  function applySourceBase64(base64: string, name: string) {
    setSourceImage({ base64, name })
    setImageSelectedModels(['fal-ai/nano-banana-pro'])
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

    if (accessToken) {
      setDescribingImage(true)
      captionImage({
        data: { imageBase64: base64, accessToken },
      })
        .then(({ caption }) => setPrompt(caption))
        .catch(() => {})
        .finally(() => setDescribingImage(false))
    }
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
    setImageSelectedModels([])
    setPrompt('')
  }

  return {
    prompt,
    setPrompt,
    orientation,
    setOrientation,
    aspectRatio,
    setAspectRatio,
    loading,
    sourceImage,
    imageSelectedModels,
    describingImage,
    inputMode: inputMode,
    activeModels,
    canGenerate,
    ratioOptions,
    handleOrientationToggle,
    handleGenerate,
    setSourceFile,
    setSourceFromUrl,
    handleClearSourceImage,
    toggleImageModel,
  }
}
