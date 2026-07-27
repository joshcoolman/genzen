'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePersistedState } from '@/lib/use-persisted-state'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { captionImage } from '@/features/ai-images/server/caption-image.server'
import { enhancePrompt } from '@/features/ai-images/server/enhance-prompt.server'
import { fetchImageAsBase64 } from '@/lib/server/fetch-image-base64.server'
import { useReportError } from '@/components/MissingKeyDialog'
import {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  flipOrientation,
  getRatioOptions,
} from '@/features/ai-images/constants'
import {
  ALL_IMAGE_MODELS,
  EDIT_MODELS,
  KONTEXT_DEV_FALLBACK_ID,
  KONTEXT_DEV_ID,
} from '@/features/ai-images/models'

// Kontext Dev is image-input only -- fall back to FLUX Dev for text-only
const EMPTY_PROMPTS: Array<string> = ['']

const KONTEXT_DEV = KONTEXT_DEV_ID
const DRAFT_TEXT_ONLY_FALLBACK = KONTEXT_DEV_FALLBACK_ID

export interface RefImage {
  id: string
  url: string
  title: string
}

interface UseGeneratorOptions {
  selectedModels: Array<string>
  gensPerModel: number
  setError: (error: string | null) => void
  storagePrefix?: string
  // Ordered per-call outcomes (one per submitted generation, in submit order),
  // so callers can map each result to its placeholder and attribute failures.
  // `model` is the user-facing base id; `recordId` is null when the submit
  // itself failed (no DB record), with `error` carrying the reason.
  onAfterSubmit?: (
    results: Array<{
      model: string
      recordId: string | null
      error: string | null
    }>,
  ) => void
  autoRefImageIds?: Array<string>
  /** Tag generations as canvas-owned: sets on_canvas + source_client at insert */
  onCanvas?: boolean
  sourceClient?: string
  /**
   * Text prepended to every submitted prompt (not shown in the textarea). Used by
   * canvas multi-image generate to auto-label images ("[Image 1, Image 2, ...]")
   * so the model can be referenced by number without the user typing it.
   */
  promptPrefix?: string
}

export interface GeneratorState {
  prompt: string
  setPrompt: (prompt: string | ((prev: string) => string)) => void
  prompts: Array<string>
  setPromptAtIndex: (index: number, value: string) => void
  addPrompt: () => void
  removePrompt: (index: number) => void
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
  setSourceFromUrls?: (
    images: Array<{ id: string; url: string; title: string }>,
  ) => void
  setSourceFromBase64: (base64: string, name: string) => void
  handleClearSourceImage: () => void
  handleClear: () => void
  handleCaption: () => Promise<void>
  generatePromptsConfig: {
    imageBase64: string
    onApply: (prompts: Array<string>) => void
  } | null
  clearPrompts: () => void
  pastePrompts: (texts: Array<string>) => void
  refImages: Array<RefImage>
  addRefImages: (images: Array<RefImage>) => void
  replaceRefImages: (images: Array<RefImage>) => void
  removeRefImage: (id: string) => void
  maxRefImages: number
  setAutoRefImageIds: (ids: Array<string>) => void
  /** Index of the prompt currently being enhanced, or null. */
  enhancingPromptIndex: number | null
  handleEnhancePrompt: (index: number) => Promise<void>
}

export function useGenerator({
  selectedModels,
  gensPerModel,
  setError,
  storagePrefix = 'genzen',
  onAfterSubmit,
  autoRefImageIds: autoRefImageIdsProp,
  onCanvas,
  sourceClient,
  promptPrefix,
}: UseGeneratorOptions): GeneratorState {
  // Surfaces failures the user can act on: a missing provider key opens the
  // key dialog, anything else toasts. `setError` alone was not enough — the AI
  // Images page never rendered it, so enhance failures vanished entirely.
  const reportError = useReportError()

  // Read the latest prefix at submit time without re-creating handleGenerate.
  const promptPrefixRef = useRef(promptPrefix ?? '')
  promptPrefixRef.current = promptPrefix ?? ''
  const promptsKey = `${storagePrefix}:prompts`
  const legacyPromptKey = `${storagePrefix}:prompt`
  const orientationKey = `${storagePrefix}:orientation`
  const aspectRatioKey = `${storagePrefix}:aspect-ratio`

  function persistPrompts(next: Array<string>) {
    localStorage.setItem(promptsKey, JSON.stringify(next))
    localStorage.removeItem(legacyPromptKey)
  }

  const [prompts, setPromptsRaw] = usePersistedState<Array<string>>(() => {
    const stored = localStorage.getItem(promptsKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        /* ignore */
      }
    }
    const legacy = localStorage.getItem(legacyPromptKey)
    if (legacy) return [legacy]
    return ['']
  }, EMPTY_PROMPTS)

  const prompt = prompts[0]
  const [orientation, setOrientation, orientationHydrated] = usePersistedState<
    'landscape' | 'portrait'
  >(
    () =>
      localStorage.getItem(orientationKey) === 'portrait'
        ? 'portrait'
        : 'landscape',
    'landscape',
  )
  const [aspectRatio, setAspectRatio, aspectRatioHydrated] = usePersistedState(
    () => localStorage.getItem(aspectRatioKey) ?? '16:9',
    '16:9',
  )
  const [loading, setLoading] = useState(false)
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
  } | null>(null)
  const [describingImage, setDescribingImage] = useState(false)
  const [enhancingPromptIndex, setEnhancingPromptIndex] = useState<
    number | null
  >(null)
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [refImages, setRefImages] = useState<Array<RefImage>>([])
  const [autoRefImageIds, setAutoRefImageIds] = useState<Array<string>>(
    autoRefImageIdsProp ?? [],
  )

  // Backwards-compat: setPrompt updates prompts[0]
  const setPrompt = useCallback(
    (value: string | ((prev: string) => string)) => {
      setPromptsRaw((prev) => {
        const next = [...prev]
        next[0] = typeof value === 'function' ? value(prev[0]) : value
        persistPrompts(next)
        return next
      })
    },
    [],
  )

  const setPromptAtIndex = useCallback((index: number, value: string) => {
    setPromptsRaw((prev) => {
      const next = [...prev]
      next[index] = value
      persistPrompts(next)
      return next
    })
  }, [])

  const addPrompt = useCallback(() => {
    setPromptsRaw((prev) => {
      const next = [...prev, '']
      persistPrompts(next)
      return next
    })
  }, [])

  const removePrompt = useCallback((index: number) => {
    setPromptsRaw((prev) => {
      if (prev.length <= 1 || index === 0) return prev
      const next = prev.filter((_, i) => i !== index)
      persistPrompts(next)
      return next
    })
  }, [])

  const pastePrompts = useCallback((texts: Array<string>) => {
    setPromptsRaw((prev) => {
      const next = [...prev, ...texts]
      persistPrompts(next)
      return next
    })
  }, [])

  // Persist orientation + aspect ratio on change. Gated on hydration: before it,
  // these still hold the SSR fallback, and writing that back erases the stored
  // value on every page load.
  useEffect(() => {
    if (!orientationHydrated) return
    localStorage.setItem(orientationKey, orientation)
  }, [orientation, orientationHydrated])

  useEffect(() => {
    if (!aspectRatioHydrated) return
    localStorage.setItem(aspectRatioKey, aspectRatio)
  }, [aspectRatio, aspectRatioHydrated])

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

  // Replace the whole ref set without capping. Caller guarantees the count fits
  // the chosen model (canvas pre-fills a known-fitting group). addRefImages, by
  // contrast, slices to maxRefImages for ad-hoc additions.
  const replaceRefImages = useCallback((images: Array<RefImage>) => {
    setRefImages(images)
  }, [])

  const activePromptCount = prompts.filter((p) => p.trim()).length
  const totalImages =
    Math.max(activePromptCount, sourceImage ? 1 : 0) *
    selectedModels.length *
    gensPerModel
  const canGenerate =
    (activePromptCount > 0 || !!sourceImage) && selectedModels.length > 0

  const ratioOptions = getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    setOrientation(flipped.orientation)
    setAspectRatio(flipped.aspectRatio)
  }

  async function handleGenerate() {
    if (loading || !canGenerate) return

    // Each entry keeps the user-facing `base` id (for labelling) alongside the
    // `resolved` endpoint we actually submit to (edit/img2img variant).
    const modelsToUse = selectedModels.flatMap((modelId) => {
      let resolved = modelId
      if (modelId === KONTEXT_DEV && !sourceImage) {
        // Kontext Dev needs a source image -- fall back to FLUX Dev for text-only
        resolved = DRAFT_TEXT_ONLY_FALLBACK
      } else if (sourceImage) {
        // If source image is present and model has an edit endpoint, use it
        const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === modelId)
        if (modelDef?.imageInputModelId && modelId !== KONTEXT_DEV) {
          resolved = modelDef.imageInputModelId
        }
      }
      return Array.from({ length: gensPerModel }, () => ({
        base: modelId,
        resolved,
      }))
    })

    // Collect non-empty prompts; if none but sourceImage exists, use ['']
    const activePrompts = prompts.filter((p) => p.trim())
    const promptsToRun = activePrompts.length > 0 ? activePrompts : ['']

    setLoading(true)
    setError(null)

    try {
      const explicitIds = refImages.map((r) => r.id)
      const autoIds =
        maxRefImages > 0
          ? autoRefImageIds.filter((id) => !explicitIds.includes(id))
          : []
      const mergedIds = [...explicitIds, ...autoIds].slice(
        0,
        maxRefImages > 0 ? maxRefImages : 0,
      )
      const referenceImageIds = mergedIds.length > 0 ? mergedIds : undefined

      // Submit order mirrors allCalls so callModels[i] labels outcomes[i].
      const callModels = promptsToRun.flatMap(() =>
        modelsToUse.map((m) => m.base),
      )
      const allCalls = promptsToRun.flatMap((promptText) => {
        const finalPrompt = `${promptPrefixRef.current}${promptText.trim()}`
        return modelsToUse.map((m) =>
          generateImage({
            prompt: finalPrompt,
            model: m.resolved,
            aspectRatio,
            idempotencyKey: crypto.randomUUID(),
            ...(sourceImage
              ? sourceImage.base64.startsWith('data:')
                ? { sourceImageBase64: sourceImage.base64 }
                : { sourceImageUrl: sourceImage.base64 }
              : {}),
            ...(selectedStyleId ? { styleId: selectedStyleId } : {}),
            ...(referenceImageIds ? { referenceImageIds } : {}),
            ...(onCanvas ? { onCanvas: true } : {}),
            ...(sourceClient ? { sourceClient } : {}),
          }),
        )
      })

      const results = await Promise.allSettled(allCalls)
      // Ordered outcomes (one per call) so the caller can map each to its
      // placeholder and mark per-model failures instead of dropping slots.
      const outcomes = results.map((r, i) => ({
        model: callModels[i],
        recordId:
          r.status === 'fulfilled'
            ? (r.value as { recordId: string }).recordId
            : null,
        error:
          r.status === 'rejected'
            ? r.reason instanceof Error
              ? r.reason.message
              : String(r.reason)
            : null,
      }))
      // Report outcomes (successes AND failures) so the caller stamps/persists/
      // polls what went through and surfaces what didn't -- no silent drops.
      if (onAfterSubmit && outcomes.length > 0) {
        onAfterSubmit(outcomes)
      }
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) {
        throw firstError.reason
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : String(err)
      // Keep page-level state (the AD context reads it) but also make sure the
      // user actually sees it.
      setError(message)
      reportError(err, message)
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

  const setSourceFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      applySourceBase64(base64, file.name)
    }
    reader.readAsDataURL(file)
  }, [])

  const setSourceFromUrl = useCallback(
    async (url: string, name: string) => {
      try {
        const { base64 } = await fetchImageAsBase64({ url })
        applySourceBase64(base64, name)
      } catch (err) {
        console.error('Failed to load image from library:', err)
      }
    },
    [applySourceBase64],
  )

  function handleClearSourceImage() {
    setSourceImage(null)
  }

  function handleClear() {
    setPromptsRaw([''])
    persistPrompts([''])
    setSourceImage(null)
    setRefImages([])
  }

  const handleCaption = useCallback(async () => {
    if (!sourceImage || describingImage) return
    setDescribingImage(true)
    try {
      const { caption } = await captionImage({
        imageBase64: sourceImage.base64,
      })
      setPrompt((prev) => (prev ? `${caption}\n\n${prev}` : caption))
    } catch {
      // caption failed silently
    } finally {
      setDescribingImage(false)
    }
  }, [sourceImage, describingImage])

  const handleEnhancePrompt = useCallback(
    async (index: number) => {
      if (enhancingPromptIndex !== null) return
      const current = prompts[index]?.trim()
      if (!current) {
        reportError('Enter a prompt before enhancing.')
        return
      }
      setEnhancingPromptIndex(index)
      try {
        const { enhancedPrompt } = await enhancePrompt({ prompt: current })
        setPromptsRaw((prev) => {
          const next = [...prev]
          next[index] = enhancedPrompt
          persistPrompts(next)
          return next
        })
      } catch (err) {
        reportError(err, 'Failed to enhance prompt')
      } finally {
        setEnhancingPromptIndex(null)
      }
    },
    [enhancingPromptIndex, prompts, reportError],
  )

  const applyGeneratedPrompts = useCallback((shotPrompts: Array<string>) => {
    setPromptsRaw((prev) => {
      const kept = prev.filter((p) => p.trim())
      const next = kept.length > 0 ? [...kept, ...shotPrompts] : shotPrompts
      persistPrompts(next)
      return next
    })
  }, [])

  const generatePromptsConfig = useMemo(
    () =>
      sourceImage
        ? { imageBase64: sourceImage.base64, onApply: applyGeneratedPrompts }
        : null,
    [sourceImage, applyGeneratedPrompts],
  )

  const clearPrompts = useCallback(() => {
    setPromptsRaw([''])
    persistPrompts([''])
  }, [])

  return {
    prompt,
    setPrompt,
    prompts,
    setPromptAtIndex,
    addPrompt,
    removePrompt,
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
    generatePromptsConfig,
    clearPrompts,
    pastePrompts,
    refImages,
    addRefImages,
    replaceRefImages,
    removeRefImage,
    maxRefImages,
    setAutoRefImageIds,
    enhancingPromptIndex,
    handleEnhancePrompt,
  }
}
