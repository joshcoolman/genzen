'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  GeneratorState,
  RefImage,
} from '#/features/ai-images/hooks/use-generator'
import type { GenerationResult } from '#/lib/types/generation-result'
import type { SavedAiImage } from '#/features/ai-images/types'
import { useAuth } from '#/lib/auth'
import { useGenerationResults } from '#/lib/hooks/useGenerationResults'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useDescribeJson } from '#/features/ai-images/hooks/use-describe-json'
import { useEditChildren } from '#/features/ai-images/hooks/use-edit-children'
import { flipOrientation, toast, useReportError } from '#/components'
import { useExistingImages } from '#/features/user-images/hooks/useExistingImages'
import { useImageUpload } from '#/features/user-images/hooks/useImageUpload'
import { editImage } from '#/features/ai-images/server/edit-image.server'
import { reparentImage } from '#/features/ai-images/server/reparent-image.server'
import { captionImage } from '#/features/ai-images/server/caption-image.server'
import { retryGeneration } from '#/features/ai-images/server/retry-generation.server'
import { enhancePrompt } from '#/features/ai-images/server/enhance-prompt.server'
import { generateVariationPrompts } from '#/features/ai-images/server/generate-variation-prompts.server'
import {
  detectAspectRatio,
  getRatioOptions,
} from '#/features/ai-images/constants'
import { getModelName, maxRefsFor } from '#/features/ai-images/models'
import {
  getEditSourceImage,
  listDescendantIds,
  listEditSourceRefs,
} from '#/features/ai-images/server/edit.actions'
import { createImageStorage } from '#/lib/image-storage'
import { fetchImageAsBase64 } from '#/lib/server/fetch-image-base64.server'

export function useEditPage(imageId: string, multiSelectIds?: Set<string>) {
  const { user } = useAuth()

  const modelSelector = useModelSelector({ capability: 'edit', mode: 'multi' })
  const reportError = useReportError()

  const [error, setError] = useState<string | null>(null)
  const [_adoptingImage, setAdoptingImage] = useState(false)

  // Source image state (DB metadata + signed URL)
  const [sourceImageMeta, setSourceImageMeta] = useState<{
    id: string
    title: string | null
    storagePath: string
    prompt: string | null
    aspectRatio: string | null
    url: string
    generationMetadata: Record<string, unknown> | null
  } | null>(null)
  const [originalImageMeta, setOriginalImageMeta] =
    useState<typeof sourceImageMeta>(null)
  const [sourceBase64, setSourceBase64] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [hasParent, setHasParent] = useState(false)

  // Generator adapter state - multi-prompt
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

  const existingImages = useExistingImages(user.id)
  const imageUpload = useImageUpload(user.id)
  const editChildren = useEditChildren(sourceChain)

  // Descendant discovery (BFS over parent_id) now runs server-side.
  const discoverDescendants = useCallback(async () => {
    const chain = await listDescendantIds(imageId).catch(() => null)
    if (chain && chain.length > 1) {
      setSourceChain(chain)
    }
  }, [imageId])

  useEffect(() => {
    void discoverDescendants()
  }, [discoverDescendants])

  const results = useGenerationResults({
    userId: user.id,
    generationType: ['edit', 'variation'],
    sourceImageIds: sourceChain,
    limit: 50,
  })

  // Fetch source image + convert to base64
  useEffect(() => {
    if (!user.id || !imageId) return

    async function fetchSource() {
      setPageLoading(true)
      const data = await getEditSourceImage(imageId).catch(() => null)

      if (!data?.storage_path) {
        setError('Image not found')
        setPageLoading(false)
        return
      }

      const signedUrl = await createImageStorage().getUrl(data.storage_path)

      if (!signedUrl) {
        setError('Failed to load image')
        setPageLoading(false)
        return
      }

      const meta = data.generation_metadata
      const srcRatio = meta?.aspect_ratio as string | undefined

      const imgMeta = {
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string | undefined) ?? null,
        aspectRatio: srcRatio ?? null,
        url: signedUrl,
        generationMetadata: meta,
      }

      setSourceImageMeta(imgMeta)
      setOriginalImageMeta(imgMeta)
      setHasParent(typeof meta?.source_image_id === 'string')

      // Fetch base64 server-side to avoid R2 CORS restrictions
      fetchImageAsBase64({ url: signedUrl })
        .then(({ base64 }) => setSourceBase64(base64))
        .catch(() => {})

      // Detect aspect ratio from image dimensions
      const img = new Image()
      img.onload = () => {
        const detected = detectAspectRatio(img.naturalWidth, img.naturalHeight)
        const [a, b] = detected.split(':').map(Number)
        setOrientation(a >= b ? 'landscape' : 'portrait')
        setAspectRatio(detected)
      }
      img.src = signedUrl

      setPageLoading(false)
    }

    void fetchSource()
  }, [user.id, imageId])

  // maxRefImages from selected models
  const maxRefImages = useMemo(() => {
    const modelId = modelSelector.selectedIds[0]
    return modelId ? maxRefsFor(modelId) : 0
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

  const replaceRefImages = useCallback((images: Array<RefImage>) => {
    setRefImages(images)
  }, [])

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  // Generate edit handler - loops over active prompts x models x gens
  const activePromptCount = prompts.filter((p) => p.trim()).length

  // Multi-select mode: use selection as references, parent as source
  const isMultiSelectMode = multiSelectIds && multiSelectIds.size > 0

  const handleGenerate = useCallback(async () => {
    if (
      activePromptCount === 0 ||
      editLoading ||
      modelSelector.selectedIds.length === 0
    )
      return
    setEditLoading(true)
    setError(null)

    const activePrompts = prompts.filter((p) => p.trim())

    try {
      // Multi-select mode: use selected images as references
      // Single-select mode: use manual ref images if any
      const referenceImageIds = isMultiSelectMode
        ? Array.from(multiSelectIds)
        : refImages.length > 0
          ? refImages.map((r) => r.id)
          : undefined

      // Multi-select mode: always use original parent as source
      // Single-select mode: use active source
      const sourceId = isMultiSelectMode ? imageId : activeSourceId

      // Each submission is isolated: one model failing must not cancel the
      // rest of the batch. Every attempt now leaves a row server-side, so a
      // failure still surfaces as a failed card with a reason and a Retry.
      const failures: Array<string> = []

      for (const promptText of activePrompts) {
        const finalPrompt = promptText.trim()
        for (const editModelId of modelSelector.selectedIds) {
          const modelLabel = getModelName(editModelId)

          for (let g = 0; g < modelSelector.gensPerModel; g++) {
            // Put the tile on the board BEFORE the request, so the click always
            // produces something visible even if the submit throws immediately.
            const tempId = crypto.randomUUID()
            results.addPendingResult({
              id: tempId,
              status: 'pending',
              label: modelLabel,
              prompt: finalPrompt,
              title: finalPrompt,
              createdAt: new Date().toISOString(),
            })

            try {
              const { recordId } = await editImage({
                sourceImageId: sourceId, // Actual image being edited (immutable history)
                parentId: imageId, // Group parent (mutable, can be reparented)
                editPrompt: finalPrompt,
                aspectRatio,
                editModelId,
                idempotencyKey: crypto.randomUUID(),
                ...(referenceImageIds ? { referenceImageIds } : {}),
              })
              results.replaceTempId(tempId, recordId)
            } catch (err) {
              const reason =
                err instanceof Error && err.message ? err.message : 'failed'
              results.failResult(tempId, reason)
              failures.push(`${modelLabel}: ${reason}`)
            }
          }
        }
      }

      if (failures.length) {
        setError(failures.join('\n'))
        toast(
          failures.length === 1
            ? failures[0]
            : `${failures.length} edits failed — see the cards for details`,
          { variant: 'error', duration: 8000 },
        )
      } else {
        setPromptsRaw([''])
      }

      // Pull the new rows in either way: on failure they are the failed cards.
      editChildren.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to edit image'
      setError(message)
      toast(message, { variant: 'error', duration: 8000 })
    } finally {
      setEditLoading(false)
    }
  }, [
    prompts,
    activePromptCount,
    editLoading,
    activeSourceId,
    aspectRatio,
    modelSelector.selectedIds,
    modelSelector.gensPerModel,
    modelSelector.models,
    results,
    refImages,
    isMultiSelectMode,
    multiSelectIds,
    imageId,
    editChildren,
  ])

  /**
   * Re-run a failed generation. `retryGeneration` submits a fresh job with the
   * same metadata and returns a NEW record id -- the failed card stays as
   * history. The optimistic tile goes up first so a retry, like any other
   * generate, always leaves something on the board.
   */
  const retryImage = useCallback(
    async (img: SavedAiImage) => {
      const tempId = crypto.randomUUID()
      const label = String(img.generation_metadata?.model ?? 'Retrying')
      const promptText = String(img.generation_metadata?.prompt ?? img.title)
      results.addPendingResult({
        id: tempId,
        status: 'pending',
        label,
        prompt: promptText,
        title: promptText,
        createdAt: new Date().toISOString(),
      })

      try {
        const { recordId } = await retryGeneration({ recordId: img.id })
        results.replaceTempId(tempId, recordId)
      } catch (err) {
        const reason =
          err instanceof Error && err.message ? err.message : 'Retry failed'
        results.failResult(tempId, reason)
        toast(reason, { variant: 'error', duration: 8000 })
      }
    },
    [results],
  )

  // Shot list prompt generation - dialog owns API call, hook just merges results
  const applyGeneratedPrompts = useCallback((shotPrompts: Array<string>) => {
    setPromptsRaw((prev) => {
      const kept = prev.filter((p) => p.trim())
      return kept.length > 0 ? [...kept, ...shotPrompts] : shotPrompts
    })
  }, [])

  const generatePromptsConfig = useMemo(
    () =>
      sourceBase64
        ? { imageBase64: sourceBase64, onApply: applyGeneratedPrompts }
        : null,
    [sourceBase64, applyGeneratedPrompts],
  )

  const clearPrompts = useCallback(() => {
    setPromptsRaw([''])
  }, [])

  // Caption handler
  const handleCaption = useCallback(async () => {
    if (!sourceBase64 || describingImage) return
    setDescribingImage(true)
    try {
      const { caption } = await captionImage({ imageBase64: sourceBase64 })
      setPrompt((prev) => (prev ? `${caption}\n\n${prev}` : caption))
    } catch {
      // caption failed silently
    } finally {
      setDescribingImage(false)
    }
  }, [sourceBase64, describingImage])

  // Describe JSON
  const describe = useDescribeJson({
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
  // Select which image to edit - works with just an ID (fetches from DB)
  const selectImageById = useCallback(
    async (targetId: string) => {
      if (!user.id) return

      const data = await getEditSourceImage(targetId).catch(() => null)

      if (!data?.storage_path) return

      const url = await createImageStorage().getUrl(data.storage_path)

      if (!url) return

      const meta = data.generation_metadata
      const srcRatio = meta?.aspect_ratio as string | undefined

      setSourceImageMeta({
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string | undefined) ?? null,
        aspectRatio: srcRatio ?? null,
        url,
        generationMetadata: meta,
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

        const detected = detectAspectRatio(img.naturalWidth, img.naturalHeight)
        const [a, b] = detected.split(':').map(Number)
        setOrientation(a >= b ? 'landscape' : 'portrait')
        setAspectRatio(detected)
      }
      img.src = url

      setActiveSourceId(targetId)
      setSourceChain((prev) =>
        prev.includes(targetId) ? prev : [...prev, targetId],
      )
      setPromptsRaw([''])
    },
    [user.id],
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

      // Restore aspect ratio from actual image dimensions
      const detected = detectAspectRatio(img.naturalWidth, img.naturalHeight)
      const [da, db] = detected.split(':').map(Number)
      setOrientation(da >= db ? 'landscape' : 'portrait')
      setAspectRatio(detected)
    }
    img.src = originalImageMeta.url
  }, [originalImageMeta, imageId])

  const isChained = activeSourceId !== imageId

  // Variation generation
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [variationPrompts, setVariationPrompts] = useState<Array<string>>([])
  const [variationPromptsLoading, setVariationPromptsLoading] = useState(false)

  const handleOpenVariationDialog = useCallback(() => {
    setVariationPrompts([])
    setVariationDialogOpen(true)
  }, [])

  const handleGenerateVariations = useCallback(
    async (guidance: string, count: number) => {
      if (!sourceImageMeta) return
      setError(null)
      setVariationPromptsLoading(true)

      try {
        let sourcePrompt = sourceImageMeta.prompt
        if (!sourcePrompt) {
          const { caption } = await captionImage({
            imageBase64: sourceImageMeta.url,
          })
          sourcePrompt = caption
          setSourceImageMeta((prev) =>
            prev ? { ...prev, prompt: caption } : prev,
          )
        }

        const result = await generateVariationPrompts({
          prompt: sourcePrompt,
          sourceImageId: activeSourceId,
          count,
          ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
        })
        setVariationPrompts(result.prompts)
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
    },
    [sourceImageMeta, activeSourceId],
  )

  // Chain images: original parent pinned at position 0, followed by all edit results
  const chainImages = useMemo((): Array<SavedAiImage> => {
    if (!originalImageMeta) return results.savedImages

    const rawMeta = originalImageMeta.generationMetadata ?? {}
    const parentAsSaved: SavedAiImage = {
      id: originalImageMeta.id,
      title: originalImageMeta.title ?? 'Source',
      storage_path: originalImageMeta.storagePath,
      status: 'completed',
      generation_error: null,
      generation_metadata: {
        prompt: originalImageMeta.prompt ?? '',
        model: (rawMeta.model as string | undefined) ?? '',
        aspect_ratio: originalImageMeta.aspectRatio ?? undefined,
        generation_type: rawMeta.generation_type as string | undefined,
        source_image_id: rawMeta.source_image_id as string | undefined,
        root_image_id: rawMeta.root_image_id as string | undefined,
        parent_id: rawMeta.parent_id as string | undefined,
      },
      created_at: new Date().toISOString(),
    }

    // Don't duplicate the parent if it already appears in results
    const filteredResults = results.savedImages.filter(
      (r) => r.id !== originalImageMeta.id,
    )
    return [parentAsSaved, ...filteredResults]
  }, [originalImageMeta, results.savedImages])

  // Fetch source image URLs for "Original" display on chain images
  const [sourceImageUrls, setSourceImageUrls] = useState<
    Record<string, string>
  >({})
  const [rootImageMeta, setRootImageMeta] = useState<
    Record<string, { hidden: boolean }>
  >({})

  useEffect(() => {
    const allImages = chainImages
    const sourceIds = new Set<string>()
    for (const img of allImages) {
      const meta = img.generation_metadata
      const genType = meta?.generation_type
      if (
        (genType === 'edit' || genType === 'variation') &&
        meta?.source_image_id
      ) {
        sourceIds.add(meta.source_image_id)
      }
    }
    if (sourceIds.size === 0) return

    async function fetchSourceUrls() {
      const rows = await listEditSourceRefs([...sourceIds]).catch(() => null)
      if (!rows) return

      const meta: Record<string, { hidden: boolean }> = {}
      const urls: Record<string, string> = {}
      await Promise.all(
        rows.map(async (r) => {
          meta[r.id] = { hidden: r.hidden }
          if (!r.storage_path) return
          const path = r.thumbnail_path ?? r.storage_path
          const url = await createImageStorage().getUrl(path)
          if (url) urls[r.id] = url
        }),
      )
      setSourceImageUrls(urls)
      setRootImageMeta(meta)
    }
    void fetchSourceUrls()
  }, [chainImages])

  const chainImageUrls = useMemo((): Record<string, string> => {
    const urls: Record<string, string> = {
      ...results.savedImageUrls,
      ...sourceImageUrls,
    }
    if (originalImageMeta) {
      urls[originalImageMeta.id] = originalImageMeta.url
    }
    return urls
  }, [originalImageMeta, results.savedImageUrls, sourceImageUrls])

  // Multi-select mode: populate ref images from selection
  const effectiveRefImages = useMemo(() => {
    if (isMultiSelectMode) {
      // Convert selected IDs to RefImage objects
      return Array.from(multiSelectIds)
        .map((id) => {
          const image = chainImages.find((img) => img.id === id)
          const url = chainImageUrls[id]
          if (!image || !url) return null
          return {
            id: image.id,
            url,
            title: image.title,
          }
        })
        .filter((ref): ref is RefImage => ref !== null)
    }
    return refImages
  }, [
    isMultiSelectMode,
    multiSelectIds,
    chainImages,
    chainImageUrls,
    refImages,
  ])

  // Active source preview: derive from activeSourceId
  const activeSourcePreview = useMemo(() => {
    if (isMultiSelectMode) return null

    // For the initial parent, use the loaded metadata
    if (activeSourceId === imageId && sourceBase64 && sourceImageMeta) {
      return {
        base64: sourceBase64,
        name: sourceImageMeta.title ?? 'Source image',
      }
    }

    // For other images, use the URL from chainImageUrls
    const url = chainImageUrls[activeSourceId]
    const image = chainImages.find((img) => img.id === activeSourceId)
    if (url && image) {
      return {
        base64: url, // Use the URL directly instead of base64
        name: image.title,
      }
    }

    return null
  }, [
    isMultiSelectMode,
    activeSourceId,
    imageId,
    sourceBase64,
    sourceImageMeta,
    chainImageUrls,
    chainImages,
  ])

  // Prompt enhancement. This page previously supplied no handler at all, so
  // GeneratorPanel hid the Enhance button entirely — the feature was simply
  // absent here rather than broken.
  const [enhancingPromptIndex, setEnhancingPromptIndex] = useState<
    number | null
  >(null)

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
        setPromptAtIndex(index, enhancedPrompt)
      } catch (err) {
        reportError(err, 'Failed to enhance prompt')
      } finally {
        setEnhancingPromptIndex(null)
      }
    },
    [enhancingPromptIndex, prompts, setPromptAtIndex, reportError],
  )

  // GeneratorState adapter - makes this hook's state compatible with GeneratorPanel
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
    // Hide source image in multi-select mode
    sourceImage: activeSourcePreview,
    describingImage,
    totalImages,
    canGenerate,
    ratioOptions,
    selectedStyleId,
    setSelectedStyleId,
    handleOrientationToggle,
    handleGenerate,
    setSourceFile: async (file: File) => {
      // Upload and adopt into this chain
      setError(null)
      setAdoptingImage(true)
      try {
        const uploaded = await imageUpload.upload({
          file,
          title: file.name,
        })
        // Adopt the uploaded image under the original parent
        await reparentImage({
          imageId: uploaded.id,
          action: 'adopt',
          newParentId: imageId,
        })
        // Refresh to discover the new child and update the gallery
        await discoverDescendants()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload image')
      } finally {
        setAdoptingImage(false)
      }
    },
    setSourceFromUrl: async (url: string, _name: string) => {
      // Adopt existing library image into this chain
      setError(null)
      setAdoptingImage(true)
      try {
        // Find the image by URL (it's in existingImages)
        const libraryImage = existingImages.images.find(
          (img) => existingImages.imageUrls[img.id] === url,
        )
        if (!libraryImage) throw new Error('Image not found')

        // Adopt it under the original parent
        await reparentImage({
          imageId: libraryImage.id,
          action: 'adopt',
          newParentId: imageId,
        })
        // Refresh to discover the adopted child and update the gallery
        await discoverDescendants()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add image')
      } finally {
        setAdoptingImage(false)
      }
    },
    setSourceFromUrls: async (
      images: Array<{ id: string; url: string; title: string }>,
    ) => {
      // Adopt multiple library images into this chain
      setError(null)
      setAdoptingImage(true)
      try {
        // Adopt all selected images under the original parent
        ;(await Promise.all(
          images.map((img) =>
            reparentImage({
              imageId: img.id,
              action: 'adopt',
              newParentId: imageId,
            }),
          ),
        ),
          // Refresh to discover the adopted children and update the gallery
          await discoverDescendants())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add images')
      } finally {
        setAdoptingImage(false)
      }
    },
    setSourceFromBase64: () => {}, // No base64 source in edit mode
    handleClear: () => {}, // No-op in edit mode
    handleClearSourceImage: () => {}, // Can't clear in edit mode
    handleCaption,
    generatePromptsConfig,
    clearPrompts,
    pastePrompts: (texts) => {
      setPromptsRaw((prev) => {
        const next = [...prev, ...texts]
        return next
      })
    },
    refImages: effectiveRefImages,
    addRefImages,
    replaceRefImages,
    removeRefImage,
    maxRefImages,
    setAutoRefImageIds: () => {},
    enhancingPromptIndex,
    handleEnhancePrompt,
  }

  return {
    generator,
    modelSelector,
    error,
    setError,
    describe,
    results,
    chainImages,
    chainImageUrls,
    rootImageMeta,
    editChildrenMap: editChildren.map,
    sourceImageMeta,
    originalImageMeta,
    activeSourceId,
    pageLoading,
    hasParent,
    isChained,
    selectImage,
    selectImageById,
    resetToOriginal,
    existingImages,
    detachFromParent: async () => {
      await reparentImage({ imageId, action: 'detach' })
      setHasParent(false)
    },
    detachResult: async (resultId: string) => {
      await reparentImage({ imageId: resultId, action: 'detach' })
      results.dismissResult(resultId)
    },
    // Retry a failed card. This submits a NEW generation with the same
    // parameters (the failed row is kept as history), which is why the edit
    // page needs its own handler rather than reusing the gallery's.
    retryImage,
    // Variations
    variationDialogOpen,
    setVariationDialogOpen,
    variationPrompts,
    variationPromptsLoading,
    handleOpenVariationDialog,
    handleGenerateVariations,
  }
}
