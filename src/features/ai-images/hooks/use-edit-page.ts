import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GeneratorState, RefImage } from './use-generator'
import type { GenerationResult } from '@/lib/types/generation-result'
import { useAuth } from '@/lib/auth'
import { useRequireCredits } from '@/features/credits/hooks/use-require-credits'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { useModelSelector } from '@/components/ModelSelector'
import { useDescribeJson } from '@/features/ai-images/hooks/use-describe-json'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { reparentImage } from '@/features/ai-images/server/reparent-image.server'
import { captionImage } from '@/features/ai-images/server/caption-image.server'
import { generateVariationPrompts } from '@/features/ai-images/server/generate-variation-prompts.server'
import { submitVariations } from '@/features/ai-images/server/submit-variations.server'
import { CREDIT_COSTS } from '@/features/credits'
import {
  detectAspectRatio,
  getRatioOptions,
} from '@/features/ai-images/constants'
import { flipOrientation } from '@/components/AspectRatioSelect'
import { EDIT_MODELS } from '@/features/ai-images/models'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'

export function useEditPage(imageId: string) {
  const { user, session } = useAuth()
  const accessToken = session?.access_token
  const credits = useRequireCredits(CREDIT_COSTS.edit)

  const modelSelector = useModelSelector({ capability: 'edit', mode: 'multi' })

  const [error, setError] = useState<string | null>(null)

  // Source image state (DB metadata + signed URL)
  const [sourceImageMeta, setSourceImageMeta] = useState<{
    id: string
    title: string | null
    storagePath: string
    prompt: string | null
    aspectRatio: string | null
    url: string
  } | null>(null)
  const [originalImageMeta, setOriginalImageMeta] =
    useState<typeof sourceImageMeta>(null)
  const [sourceBase64, setSourceBase64] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [hasParent, setHasParent] = useState(false)

  // Generator adapter state — multi-prompt
  const [prompts, setPromptsRaw] = useState<Array<string>>([''])
  const prompt = prompts[0]
  const setPrompt = useCallback(
    (value: string | ((prev: string) => string)) => {
      setPromptsRaw((prev) => {
        const next = [...prev]
        next[0] = typeof value === 'function' ? value(prev[0]) : value
        return next
      })
    },
    [],
  )
  const setPromptAtIndex = useCallback((index: number, value: string) => {
    setPromptsRaw((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])
  const addPrompt = useCallback(() => {
    setPromptsRaw((prev) => [...prev, ''])
  }, [])
  const removePrompt = useCallback((index: number) => {
    setPromptsRaw((prev) => {
      if (prev.length <= 1 || index === 0) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [editLoading, setEditLoading] = useState(false)
  const [describingImage, setDescribingImage] = useState(false)
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [refImages, setRefImages] = useState<Array<RefImage>>([])

  // Source chain tracking
  const [activeSourceId, setActiveSourceId] = useState(imageId)
  const [sourceChain, setSourceChain] = useState<Array<string>>([imageId])

  const existingImages = useExistingImages(user?.id)

  // BFS descendant discovery
  useEffect(() => {
    if (!user?.id) return

    async function discoverDescendants() {
      const { data } = await supabase
        .from('user_images')
        .select('id, generation_metadata')
        .eq('user_id', user!.id)
        .in('source', ['upload', 'ai_generated'])
        .is('deleted_at', null)

      if (!data) return

      const childrenOf = new Map<string, Array<string>>()
      for (const row of data) {
        const meta = row.generation_metadata as Record<string, unknown> | null
        if (typeof meta?.source_image_id === 'string') {
          const srcId = meta.source_image_id
          const siblings = childrenOf.get(srcId) ?? []
          siblings.push(row.id)
          childrenOf.set(srcId, siblings)
        }
      }

      const chain = [imageId]
      const visited = new Set([imageId])
      const queue = [imageId]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const childId of childrenOf.get(current) ?? []) {
          if (!visited.has(childId)) {
            visited.add(childId)
            chain.push(childId)
            queue.push(childId)
          }
        }
      }

      if (chain.length > 1) {
        setSourceChain(chain)
      }
    }

    void discoverDescendants()
  }, [user?.id, imageId])

  const results = useGenerationResults({
    userId: user?.id,
    accessToken: accessToken ?? '',
    generationType: ['edit', 'variation'],
    sourceImageIds: sourceChain,
    limit: 50,
  })

  // Fetch source image + convert to base64
  useEffect(() => {
    if (!user?.id || !imageId) return

    async function fetchSource() {
      setPageLoading(true)
      const { data } = await supabase
        .from('user_images')
        .select('id, title, storage_path, generation_metadata')
        .eq('id', imageId)
        .eq('user_id', user!.id)
        .single()

      if (!data?.storage_path) {
        setError('Image not found')
        setPageLoading(false)
        return
      }

      const signedUrl = await createImageStorage(supabase).getUrl(
        data.storage_path,
        { cached: false },
      )

      if (!signedUrl) {
        setError('Failed to load image')
        setPageLoading(false)
        return
      }

      const meta = data.generation_metadata as Record<string, unknown> | null
      const srcRatio = meta?.aspect_ratio as string | undefined

      const imgMeta = {
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string | undefined) ?? null,
        aspectRatio: srcRatio ?? null,
        url: signedUrl,
      }

      setSourceImageMeta(imgMeta)
      setOriginalImageMeta(imgMeta)
      setHasParent(typeof meta?.source_image_id === 'string')

      // Convert signed URL to base64 via canvas
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          setSourceBase64(canvas.toDataURL('image/png'))
        }

        // Set aspect ratio
        if (srcRatio) {
          const [a, b] = srcRatio.split(':').map(Number)
          setOrientation(a >= b ? 'landscape' : 'portrait')
          setAspectRatio(srcRatio)
        } else {
          const detected = detectAspectRatio(
            img.naturalWidth,
            img.naturalHeight,
          )
          const [a, b] = detected.split(':').map(Number)
          setOrientation(a >= b ? 'landscape' : 'portrait')
          setAspectRatio(detected)
        }
      }
      img.src = signedUrl

      setPageLoading(false)
    }

    void fetchSource()
  }, [user?.id, imageId])

  // maxRefImages from selected models
  const maxRefImages = useMemo(() => {
    const modelId = modelSelector.selectedIds[0]
    if (!modelId) return 0
    const editModel = EDIT_MODELS.find((m) => m.id === modelId)
    return editModel?.maxRefImages ?? 0
  }, [modelSelector.selectedIds])

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

  // Generate edit handler — loops over active prompts x models x gens
  const activePromptCount = prompts.filter((p) => p.trim()).length

  const handleGenerate = useCallback(async () => {
    if (
      activePromptCount === 0 ||
      !accessToken ||
      editLoading ||
      modelSelector.selectedIds.length === 0
    )
      return
    setEditLoading(true)
    setError(null)

    const activePrompts = prompts.filter((p) => p.trim())
    const totalEdits =
      activePrompts.length *
      modelSelector.selectedIds.length *
      modelSelector.gensPerModel
    const cost = CREDIT_COSTS.edit * totalEdits

    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      setEditLoading(false)
      return
    }

    try {
      const referenceImageIds =
        refImages.length > 0 ? refImages.map((r) => r.id) : undefined

      for (const promptText of activePrompts) {
        const finalPrompt = promptText.trim()
        for (const editModelId of modelSelector.selectedIds) {
          for (let g = 0; g < modelSelector.gensPerModel; g++) {
            const { recordId } = await editImage({
              data: {
                accessToken,
                sourceImageId: activeSourceId,
                editPrompt: finalPrompt,
                aspectRatio,
                editModelId,
                idempotencyKey: crypto.randomUUID(),
                ...(referenceImageIds ? { referenceImageIds } : {}),
              },
            })

            results.addPendingResult({
              id: recordId,
              status: 'pending',
              label:
                EDIT_MODELS.find((m) => m.id === editModelId)?.name ??
                modelSelector.models.find((m) => m.id === editModelId)?.name ??
                editModelId,
              prompt: finalPrompt,
              title: finalPrompt,
              createdAt: new Date().toISOString(),
            })
          }
        }
      }
      setPromptsRaw([''])
      await credits.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit image')
    } finally {
      setEditLoading(false)
    }
  }, [
    prompts,
    activePromptCount,
    accessToken,
    editLoading,
    activeSourceId,
    aspectRatio,
    modelSelector.selectedIds,
    modelSelector.gensPerModel,
    modelSelector.models,
    credits,
    results,
    refImages,
  ])

  // Shot list prompt generation — dialog owns API call, hook just merges results
  const applyGeneratedPrompts = useCallback((shotPrompts: Array<string>) => {
    setPromptsRaw((prev) => {
      const kept = prev.filter((p) => p.trim())
      return kept.length > 0 ? [...kept, ...shotPrompts] : shotPrompts
    })
  }, [])

  const generatePromptsConfig = useMemo(
    () =>
      accessToken && sourceBase64
        ? {
            accessToken,
            imageBase64: sourceBase64,
            onApply: applyGeneratedPrompts,
          }
        : null,
    [accessToken, sourceBase64, applyGeneratedPrompts],
  )

  const clearPrompts = useCallback(() => {
    setPromptsRaw([''])
  }, [])

  // Caption handler
  const handleCaption = useCallback(async () => {
    if (!accessToken || !sourceBase64 || describingImage) return
    setDescribingImage(true)
    try {
      const { caption } = await captionImage({
        data: { imageBase64: sourceBase64, accessToken },
      })
      setPrompt((prev) => (prev ? `${caption}\n\n${prev}` : caption))
    } catch {
      // caption failed silently
    } finally {
      setDescribingImage(false)
    }
  }, [accessToken, sourceBase64, describingImage])

  // Describe JSON
  const describe = useDescribeJson({
    accessToken,
    imageUrl: sourceImageMeta?.url,
    onResult: useCallback((json: string) => {
      setPrompt((prev) => (prev ? `${prev}\n\n${json}` : json))
    }, []),
  })

  const totalImages =
    activePromptCount *
    modelSelector.selectedIds.length *
    modelSelector.gensPerModel
  const canGenerate =
    activePromptCount > 0 && modelSelector.selectedIds.length > 0

  const ratioOptions = getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    setOrientation(flipped.orientation)
    setAspectRatio(flipped.aspectRatio)
  }

  // Select image for editing
  // Select which image to edit — works with just an ID (fetches from DB)
  const selectImageById = useCallback(
    async (targetId: string) => {
      if (!user?.id) return

      const { data } = await supabase
        .from('user_images')
        .select('id, title, storage_path, generation_metadata')
        .eq('id', targetId)
        .eq('user_id', user.id)
        .single()

      if (!data?.storage_path) return

      const url = await createImageStorage(supabase).getUrl(data.storage_path)

      if (!url) return

      const meta = data.generation_metadata as Record<string, unknown> | null
      const srcRatio = meta?.aspect_ratio as string | undefined

      setSourceImageMeta({
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string | undefined) ?? null,
        aspectRatio: srcRatio ?? null,
        url,
      })

      // Convert to base64
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          setSourceBase64(canvas.toDataURL('image/png'))
        }

        if (srcRatio) {
          const [a, b] = srcRatio.split(':').map(Number)
          setOrientation(a >= b ? 'landscape' : 'portrait')
          setAspectRatio(srcRatio)
        } else {
          const detected = detectAspectRatio(
            img.naturalWidth,
            img.naturalHeight,
          )
          const [a, b] = detected.split(':').map(Number)
          setOrientation(a >= b ? 'landscape' : 'portrait')
          setAspectRatio(detected)
        }
      }
      img.src = url

      setActiveSourceId(targetId)
      setSourceChain((prev) =>
        prev.includes(targetId) ? prev : [...prev, targetId],
      )
      setPromptsRaw([''])
    },
    [user?.id],
  )

  // Select which image to edit from a GenerationResult
  const selectImage = useCallback(
    async (result: GenerationResult) => {
      await selectImageById(result.id)
    },
    [selectImageById],
  )

  const resetToOriginal = useCallback(() => {
    if (!originalImageMeta) return
    setSourceImageMeta(originalImageMeta)
    setActiveSourceId(imageId)
    setPromptsRaw([''])

    // Re-convert original to base64
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        setSourceBase64(canvas.toDataURL('image/png'))
      }
    }
    img.src = originalImageMeta.url
  }, [originalImageMeta, imageId])

  const isChained = activeSourceId !== imageId

  // Variation generation
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [variationPrompts, setVariationPrompts] = useState<Array<string>>([])
  const [variationPromptsLoading, setVariationPromptsLoading] = useState(false)
  const [variationSubmitting] = useState(false)
  const [generatingMore, setGeneratingMore] = useState(false)
  const [variationMeta, setVariationMeta] = useState<{
    rootPrompt: string
    rootImageId: string
    sourceImageId: string
    falImageUrl?: string
  } | null>(null)

  const handleGenerateVariations = useCallback(async () => {
    if (!accessToken || !sourceImageMeta) return
    setError(null)
    setVariationDialogOpen(true)
    setVariationPromptsLoading(true)
    setVariationPrompts([])

    try {
      let sourcePrompt = sourceImageMeta.prompt
      if (!sourcePrompt) {
        const { caption } = await captionImage({
          data: { imageBase64: sourceImageMeta.url, accessToken },
        })
        sourcePrompt = caption
        setSourceImageMeta((prev) =>
          prev ? { ...prev, prompt: caption } : prev,
        )
      }

      const result = await generateVariationPrompts({
        data: {
          accessToken,
          prompt: sourcePrompt,
          sourceImageId: activeSourceId,
          count: 4,
        },
      })
      setVariationPrompts(result.prompts)
      setVariationMeta({
        rootPrompt: result.rootPrompt,
        rootImageId: result.rootImageId,
        sourceImageId: result.sourceImageId,
        falImageUrl: result.falImageUrl,
      })
    } catch (err) {
      setVariationDialogOpen(false)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate variation prompts',
      )
    } finally {
      setVariationPromptsLoading(false)
    }
  }, [accessToken, sourceImageMeta?.prompt, activeSourceId])

  const handleGenerateMoreVariations = useCallback(async () => {
    if (!accessToken || !sourceImageMeta?.prompt) return
    setGeneratingMore(true)
    try {
      const result = await generateVariationPrompts({
        data: {
          accessToken,
          prompt: sourceImageMeta.prompt,
          sourceImageId: activeSourceId,
          count: 1,
          existingPrompts: variationPrompts,
        },
      })
      setVariationPrompts((prev) => [...prev, ...result.prompts])
    } catch {
      // silently fail
    } finally {
      setGeneratingMore(false)
    }
  }, [accessToken, sourceImageMeta?.prompt, activeSourceId, variationPrompts])

  const handleRunVariations = useCallback(
    async (variationTexts: Array<string>) => {
      if (!accessToken || !variationMeta || !sourceImageMeta) return
      const cost = CREDIT_COSTS.variation * variationTexts.length
      if (credits.balance !== null && credits.balance < cost) {
        credits.showInsufficientCredits(cost)
        return
      }

      // Close dialog and add optimistic pending results immediately
      setVariationDialogOpen(false)

      const now = new Date().toISOString()
      const optimisticIds = variationTexts.map(
        (_, i) => `optimistic-var-${Date.now()}-${i}`,
      )
      for (let i = 0; i < variationTexts.length; i++) {
        results.addPendingResult({
          id: optimisticIds[i],
          status: 'pending',
          label: 'Kontext Pro',
          prompt: variationTexts[i],
          title: variationTexts[i],
          createdAt: now,
        })
      }

      try {
        const refIds = refImages.map((r) => r.id)
        const variationResults = await submitVariations({
          data: {
            accessToken,
            prompts: variationTexts,
            model: 'fal-ai/flux-pro/kontext',
            sourceImageId: variationMeta.sourceImageId,
            rootImageId: variationMeta.rootImageId,
            rootPrompt: variationMeta.rootPrompt,
            aspectRatio,
            falImageUrl: variationMeta.falImageUrl,
            ...(refIds.length > 0 ? { referenceImageIds: refIds } : {}),
          },
        })

        // Replace optimistic IDs with real DB IDs
        for (let i = 0; i < variationResults.length; i++) {
          if (i < optimisticIds.length) {
            results.replaceTempId(
              optimisticIds[i],
              variationResults[i].recordId,
            )
          }
        }
        // Remove any extra optimistic cards that didn't get a real result
        for (let i = variationResults.length; i < optimisticIds.length; i++) {
          results.dismissResult(optimisticIds[i])
        }

        await credits.refresh()
      } catch (err) {
        // Remove all optimistic cards on error
        for (const id of optimisticIds) {
          results.dismissResult(id)
        }
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('Insufficient credits')) {
          credits.showInsufficientCredits(cost)
        } else {
          setError(message)
        }
      }
    },
    [accessToken, variationMeta, aspectRatio, credits, results, refImages],
  )

  // GeneratorState adapter — makes this hook's state compatible with GeneratorPanel
  const generator: GeneratorState = {
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
    loading: editLoading,
    sourceImage:
      sourceBase64 && sourceImageMeta
        ? {
            base64: sourceBase64,
            name: sourceImageMeta.title ?? 'Source image',
          }
        : null,
    describingImage,
    totalImages,
    canGenerate,
    ratioOptions,
    selectedStyleId,
    setSelectedStyleId,
    handleOrientationToggle,
    handleGenerate,
    setSourceFile: () => {}, // No file upload in edit mode — source comes from route
    setSourceFromUrl: () => {}, // No URL source in edit mode
    setSourceFromBase64: () => {}, // No base64 source in edit mode
    handleClear: () => {}, // No-op in edit mode
    handleClearSourceImage: () => {}, // Can't clear in edit mode
    handleCaption,
    generatePromptsConfig,
    clearPrompts,
    refImages,
    addRefImages,
    removeRefImage,
    maxRefImages,
  }

  return {
    generator,
    modelSelector,
    credits,
    error,
    setError,
    describe,
    results,
    sourceImageMeta,
    originalImageMeta,
    pageLoading,
    hasParent,
    isChained,
    selectImage,
    selectImageById,
    resetToOriginal,
    existingImages,
    detachFromParent: async () => {
      if (!accessToken) return
      await reparentImage({
        data: { accessToken, imageId, action: 'detach' },
      })
      setHasParent(false)
    },
    detachResult: async (resultId: string) => {
      if (!accessToken) return
      await reparentImage({
        data: { accessToken, imageId: resultId, action: 'detach' },
      })
      results.dismissResult(resultId)
    },
    // Variations
    variationDialogOpen,
    setVariationDialogOpen,
    variationPrompts,
    variationPromptsLoading,
    variationSubmitting,
    handleGenerateVariations,
    handleRunVariations,
    handleGenerateMoreVariations,
    generatingMore,
  }
}
