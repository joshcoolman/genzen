import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeShotImage } from '../server/describe-shot-image.server'
import { generateShotPrompts } from '../server/generate-shot-prompts.server'
import { generateShotImages } from '../server/generate-shot-images.server'
import type { SelectedImage } from '@/components/LibraryPickerButton'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { useAuth } from '@/lib/auth'

type StepStatus = 'idle' | 'running' | 'complete' | 'error'

export const SHOT_MODELS = [
  { id: 'fal-ai/nano-banana-2/edit', name: 'Nano Banana 2' },
] as const

function buildTemplate(count: number): string {
  return `Create ${count} different views of the image provided for an image model to output images, prompts only separated by an asterisk.`
}

function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

function lsSet(key: string, value: string) {
  localStorage.setItem(key, value)
}

function lsRemove(key: string) {
  localStorage.removeItem(key)
}

export function useShotsPage() {
  const { user, session } = useAuth()
  const accessToken = session?.access_token ?? ''
  const existingImages = useExistingImages(user?.id)

  // Source image (URL persisted to localStorage; base64 uploads are too large)
  const [sourceImageUrl, setSourceImageUrlRaw] = useState<string | null>(() =>
    lsGet('shots-source-url'),
  )
  const [sourceImageBase64, setSourceImageBase64] = useState<string | null>(
    null,
  )

  const setSourceImageUrl = useCallback((url: string | null) => {
    setSourceImageUrlRaw(url)
    if (url) {
      lsSet('shots-source-url', url)
    } else {
      lsRemove('shots-source-url')
    }
  }, [])

  // Step 1: Describe (restored from localStorage)
  const [step1Status, setStep1Status] = useState<StepStatus>(() => {
    const saved = lsGet('shots-description')
    return saved ? 'complete' : 'idle'
  })
  const [step1Output, setStep1OutputRaw] = useState(
    () => lsGet('shots-description') ?? '',
  )
  const [step1Error, setStep1Error] = useState<string | null>(null)

  const setStep1Output = useCallback((value: string) => {
    setStep1OutputRaw(value)
    if (value) {
      lsSet('shots-description', value)
    } else {
      lsRemove('shots-description')
    }
  }, [])

  // Model selection (persisted to localStorage)
  const [modelId, setModelIdRaw] = useState<string>(
    () => lsGet('shots-model-id') ?? SHOT_MODELS[0].id,
  )

  const setModelId = useCallback((id: string) => {
    setModelIdRaw(id)
    lsSet('shots-model-id', id)
  }, [])

  // Step 2: Prompt template (count persisted, template persisted)
  const [promptCount, setPromptCount] = useState(() => {
    const saved = lsGet('shots-prompt-count')
    return saved ? Math.max(1, Math.min(10, Number(saved))) : 4
  })
  const [promptTemplate, setPromptTemplateRaw] = useState(() => {
    const saved = lsGet('shots-template')
    if (saved) return saved
    const count =
      typeof window !== 'undefined'
        ? Math.max(
            1,
            Math.min(
              10,
              Number(localStorage.getItem('shots-prompt-count')) || 4,
            ),
          )
        : 4
    return buildTemplate(count)
  })

  const setPromptTemplate = useCallback((value: string) => {
    setPromptTemplateRaw(value)
    lsSet('shots-template', value)
  }, [])

  // Step 3: Generate prompts (restored from localStorage)
  const [step3Status, setStep3Status] = useState<StepStatus>(() => {
    const saved = lsGet('shots-prompts')
    return saved ? 'complete' : 'idle'
  })
  const [step3Output, setStep3OutputRaw] = useState(
    () => lsGet('shots-prompts') ?? '',
  )
  const [step3Error, setStep3Error] = useState<string | null>(null)

  const setStep3Output = useCallback((value: string) => {
    setStep3OutputRaw(value)
    if (value) {
      lsSet('shots-prompts', value)
    } else {
      lsRemove('shots-prompts')
    }
  }, [])

  // Split prompts (derived)
  const splitPrompts = useMemo(() => {
    if (!step3Output) return []
    return step3Output
      .split('*')
      .map((p) => p.trim())
      .filter(Boolean)
  }, [step3Output])

  // Generation results
  const generationResults = useGenerationResults({
    userId: user?.id,
    accessToken,
    generationType: 'shot',
  })

  const imageUrl = sourceImageUrl ?? sourceImageBase64

  // Update template when count changes
  const handleSetPromptCount = useCallback((count: number) => {
    const clamped = Math.max(1, Math.min(10, count))
    setPromptCount(clamped)
    const newTemplate = buildTemplate(clamped)
    setPromptTemplateRaw(newTemplate)
    lsSet('shots-template', newTemplate)
    lsSet('shots-prompt-count', String(clamped))
  }, [])

  // Set source from file upload/paste
  const setSourceImage = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setSourceImageBase64(reader.result as string)
      setSourceImageUrl(null)
    }
    reader.readAsDataURL(file)
  }, [])

  // Set source from library
  const selectLibraryImage = useCallback((image: SelectedImage) => {
    setSourceImageUrl(image.url)
    setSourceImageBase64(null)
  }, [])

  // Set source from a URL (e.g. from a generated result)
  const setSourceFromUrl = useCallback((url: string) => {
    setSourceImageUrl(url)
    setSourceImageBase64(null)
  }, [])

  // Auto-describe when image changes
  // Init prevImageRef from saved URL so useEffect doesn't re-fire for same image
  const prevImageRef = useRef<string | null>(lsGet('shots-source-url'))
  useEffect(() => {
    if (!imageUrl || imageUrl === prevImageRef.current) return
    prevImageRef.current = imageUrl

    // Image changed — clear cached description + prompts
    lsRemove('shots-description')
    lsRemove('shots-prompts')

    setStep1Status('running')
    setStep1Error(null)
    setStep3Status('idle')
    setStep3OutputRaw('')
    lsRemove('shots-prompts')

    describeShotImage({ data: { imageUrl, accessToken } })
      .then((result) => {
        setStep1OutputRaw(result.description)
        lsSet('shots-description', result.description)
        setStep1Status('complete')
      })
      .catch((err) => {
        setStep1Error(err instanceof Error ? err.message : 'Failed to describe')
        setStep1Status('error')
      })
  }, [imageUrl, accessToken])

  // Standalone: describe image (re-run step 1)
  const describeImage = useCallback(async () => {
    if (!imageUrl) return

    setStep1Status('running')
    setStep1Error(null)

    try {
      const result = await describeShotImage({
        data: { imageUrl, accessToken },
      })
      setStep1OutputRaw(result.description)
      lsSet('shots-description', result.description)
      setStep1Status('complete')
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Failed to describe')
      setStep1Status('error')
    }
  }, [imageUrl, accessToken])

  // Describe from a directly-provided file (paste/upload to describer)
  const describeFromFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        setStep1Status('running')
        setStep1Error(null)
        try {
          const result = await describeShotImage({
            data: { imageUrl: dataUrl, accessToken },
          })
          setStep1OutputRaw(result.description)
          lsSet('shots-description', result.description)
          setStep1Status('complete')
        } catch (err) {
          setStep1Error(
            err instanceof Error ? err.message : 'Failed to describe',
          )
          setStep1Status('error')
        }
      }
      reader.readAsDataURL(file)
    },
    [accessToken],
  )

  // Describe from a library image URL
  const describeFromLibrary = useCallback(
    async (image: SelectedImage) => {
      setStep1Status('running')
      setStep1Error(null)
      try {
        const result = await describeShotImage({
          data: { imageUrl: image.url, accessToken },
        })
        setStep1OutputRaw(result.description)
        lsSet('shots-description', result.description)
        setStep1Status('complete')
      } catch (err) {
        setStep1Error(err instanceof Error ? err.message : 'Failed to describe')
        setStep1Status('error')
      }
    },
    [accessToken],
  )

  // Standalone: generate prompts (run step 3 only)
  const generatePrompts = useCallback(async () => {
    if (!step1Output) return

    setStep3Status('running')
    setStep3Error(null)

    try {
      const result = await generateShotPrompts({
        data: {
          description: step1Output,
          promptTemplate,
          accessToken,
        },
      })
      setStep3OutputRaw(result.rawOutput)
      lsSet('shots-prompts', result.rawOutput)
      setStep3Status('complete')
    } catch (err) {
      setStep3Error(
        err instanceof Error ? err.message : 'Failed to generate prompts',
      )
      setStep3Status('error')
    }
  }, [step1Output, promptTemplate, accessToken])

  const modelLabel = SHOT_MODELS.find((m) => m.id === modelId)?.name ?? 'Shot'

  // Whether generate is possible
  const isGenerating =
    step3Status === 'running' || generationResults.isSubmitting
  const canGenerate = !!imageUrl && step1Status === 'complete' && !isGenerating

  // Single "Generate Images" action: chains prompts -> split -> submit
  const generateImages = useCallback(async () => {
    if (!imageUrl || !step1Output) return

    // Use existing description, generate prompts
    setStep3Status('running')
    setStep3Error(null)
    let rawOutput: string
    try {
      const result = await generateShotPrompts({
        data: {
          description: step1Output,
          promptTemplate,
          accessToken,
        },
      })
      rawOutput = result.rawOutput
      setStep3OutputRaw(rawOutput)
      lsSet('shots-prompts', rawOutput)
      setStep3Status('complete')
    } catch (err) {
      setStep3Error(
        err instanceof Error ? err.message : 'Failed to generate prompts',
      )
      setStep3Status('error')
      return
    }

    // Parse and submit
    const prompts = rawOutput
      .split('*')
      .map((p) => p.trim())
      .filter(Boolean)
    if (prompts.length === 0) return

    generationResults.setIsSubmitting(true)
    generationResults.setError(null)
    try {
      const result = await generateShotImages({
        data: {
          prompts,
          sourceImageUrl: imageUrl,
          accessToken,
          modelId,
        },
      })
      for (const r of result.results) {
        generationResults.addPendingResult({
          id: r.recordId,
          status: 'pending',
          label: modelLabel,
          prompt: r.prompt,
        })
      }
    } catch (err) {
      generationResults.setError(
        err instanceof Error ? err.message : 'Failed to generate images',
      )
    } finally {
      generationResults.setIsSubmitting(false)
    }
  }, [
    imageUrl,
    step1Output,
    promptTemplate,
    accessToken,
    modelId,
    modelLabel,
    generationResults,
  ])

  // Reset all state
  const reset = useCallback(() => {
    prevImageRef.current = null
    setSourceImageUrl(null)
    setSourceImageBase64(null)
    setStep1Status('idle')
    setStep1OutputRaw('')
    setStep1Error(null)
    setPromptCount(4)
    const defaultTemplate = buildTemplate(4)
    setPromptTemplateRaw(defaultTemplate)
    setStep3Status('idle')
    setStep3OutputRaw('')
    setStep3Error(null)
    lsRemove('shots-source-url')
    lsRemove('shots-prompt-count')
    lsRemove('shots-description')
    lsRemove('shots-template')
    lsRemove('shots-prompts')
    lsRemove('shots-step-description')
    lsRemove('shots-step-template')
    lsRemove('shots-step-prompts')
  }, [setSourceImageUrl])

  return {
    sourceImageUrl: imageUrl,
    existingImages,
    setSourceImage,
    selectLibraryImage,
    setSourceFromUrl,
    modelId,
    setModelId,
    step1: {
      status: step1Status,
      output: step1Output,
      setOutput: setStep1Output,
      error: step1Error,
    },
    step2: {
      template: promptTemplate,
      setTemplate: setPromptTemplate,
      count: promptCount,
      setCount: handleSetPromptCount,
    },
    step3: {
      status: step3Status,
      output: step3Output,
      setOutput: setStep3Output,
      error: step3Error,
    },
    splitPrompts,
    generationResults,
    canGenerate,
    isGenerating,
    generateImages,
    describeImage,
    describeFromFile,
    describeFromLibrary,
    generatePrompts,
    reset,
  }
}

export type UseShotsPageReturn = ReturnType<typeof useShotsPage>
