import { useCallback, useEffect, useState } from 'react'
import type { GenerationResult } from '@/lib/types/generation-result'
import type { CollectedImage } from '@/features/user-images/types'
import { useAuth } from '@/lib/auth'
import { useRequireCredits } from '@/features/credits/hooks/use-require-credits'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { reparentImage } from '@/features/ai-images/server/reparent-image.server'
import { useDescribeJson } from '@/features/ai-images/hooks/use-describe-json'
import { generateVariationPrompts } from '@/features/ai-images/server/generate-variation-prompts.server'
import { submitVariations } from '@/features/ai-images/server/submit-variations.server'
import { CREDIT_COSTS } from '@/features/credits'
import {
  detectAspectRatio,
  getRatioOptions,
} from '@/features/ai-images/constants'
import { EDIT_MODELS } from '@/features/ai-images/models'
import { useModelSelector } from '@/components/ModelSelector'
import { supabase } from '@/lib/supabase'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'

interface SourceImage {
  id: string
  title: string | null
  storagePath: string
  prompt: string | null
  aspectRatio: string | null
  url: string
}

export function useFocusedEdit(imageId: string) {
  const { user, session } = useAuth()
  const accessToken = session?.access_token
  const credits = useRequireCredits(CREDIT_COSTS.edit)

  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [originalImage, setOriginalImage] = useState<SourceImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasParent, setHasParent] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const modelSelector = useModelSelector({ capability: 'edit', mode: 'multi' })

  // Source chain: tracks all image IDs whose edits should be visible
  const [activeSourceId, setActiveSourceId] = useState(imageId)
  const [sourceChain, setSourceChain] = useState<Array<string>>([imageId])

  const ratioOptions = getRatioOptions(orientation)

  // Discover all descendant edit IDs on mount so chained edits appear
  useEffect(() => {
    if (!user?.id) return

    async function discoverDescendants() {
      const { data } = await supabase
        .from('user_images')
        .select('id, generation_metadata')
        .eq('user_id', user!.id)
        .eq('source', 'ai_generated')
        .is('deleted_at', null)

      if (!data) return

      // Build parent -> children map from all images with a source_image_id
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

      // BFS from root imageId to find all descendants
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

  // Fetch source image
  useEffect(() => {
    if (!user?.id || !imageId) return

    async function fetchSource() {
      setLoading(true)
      const { data } = await supabase
        .from('user_images')
        .select('id, title, storage_path, generation_metadata')
        .eq('id', imageId)
        .eq('user_id', user!.id)
        .single()

      if (!data?.storage_path) {
        setError('Image not found')
        setLoading(false)
        return
      }

      const { data: signed } = await supabase.storage
        .from('user-images')
        .createSignedUrl(data.storage_path, 86400)

      if (!signed?.signedUrl) {
        setError('Failed to load image')
        setLoading(false)
        return
      }

      const meta = data.generation_metadata as Record<string, unknown> | null
      const srcRatio = meta?.aspect_ratio as string | undefined

      const src: SourceImage = {
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string | undefined) ?? null,
        aspectRatio: srcRatio ?? null,
        url: signed.signedUrl,
      }

      setSourceImage(src)
      setOriginalImage(src)
      setHasParent(typeof meta?.source_image_id === 'string')

      // Set aspect ratio from source image
      if (srcRatio) {
        const [a, b] = srcRatio.split(':').map(Number)
        setOrientation(a >= b ? 'landscape' : 'portrait')
        setAspectRatio(srcRatio)
      } else {
        // Detect from image dimensions
        const probe = new Image()
        probe.onload = () => {
          const detected = detectAspectRatio(
            probe.naturalWidth,
            probe.naturalHeight,
          )
          const [a, b] = detected.split(':').map(Number)
          setOrientation(a >= b ? 'landscape' : 'portrait')
          setAspectRatio(detected)
        }
        probe.src = signed.signedUrl
      }

      setLoading(false)
    }

    void fetchSource()
  }, [user?.id, imageId])

  const handleRegenerate = useCallback(
    async (prompt: string, modelId: string) => {
      if (!prompt.trim() || !accessToken || editLoading) return
      setEditLoading(true)
      setError(null)
      try {
        await credits.deduct(CREDIT_COSTS.edit, 'edit')
        const { recordId } = await editImage({
          data: {
            accessToken,
            sourceImageId: activeSourceId,
            editPrompt: prompt.trim(),
            aspectRatio,
            editModelId: modelId,
          },
        })

        results.addPendingResult({
          id: recordId,
          status: 'pending',
          label: EDIT_MODELS.find((m) => m.id === modelId)?.name ?? modelId,
          prompt: prompt.trim(),
        })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to regenerate edit',
        )
      } finally {
        setEditLoading(false)
      }
    },
    [accessToken, editLoading, activeSourceId, aspectRatio, credits, results],
  )

  const handleSubmit = useCallback(async () => {
    if (
      !editPrompt.trim() ||
      !accessToken ||
      editLoading ||
      modelSelector.selectedIds.length === 0
    )
      return
    setEditLoading(true)
    setError(null)
    const prompt = editPrompt.trim()
    const totalEdits =
      modelSelector.selectedIds.length * modelSelector.gensPerModel
    try {
      await credits.deduct(CREDIT_COSTS.edit * totalEdits, 'edit')
      for (const editModelId of modelSelector.selectedIds) {
        for (let g = 0; g < modelSelector.gensPerModel; g++) {
          const { recordId } = await editImage({
            data: {
              accessToken,
              sourceImageId: activeSourceId,
              editPrompt: prompt,
              aspectRatio,
              editModelId,
            },
          })

          results.addPendingResult({
            id: recordId,
            status: 'pending',
            label:
              EDIT_MODELS.find((m) => m.id === editModelId)?.name ??
              modelSelector.models.find((m) => m.id === editModelId)?.name ??
              editModelId,
            prompt,
          })
        }
      }
      setEditPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit image')
    } finally {
      setEditLoading(false)
    }
  }, [
    editPrompt,
    accessToken,
    editLoading,
    activeSourceId,
    aspectRatio,
    modelSelector.selectedIds,
    modelSelector.gensPerModel,
    modelSelector.models,
    credits,
    results,
  ])

  const describe = useDescribeJson({
    accessToken,
    imageUrl: sourceImage?.url,
  })

  const handleDescribeJson = useCallback(async () => {
    await describe.handleDescribe()
    if (describe.jsonDescription) {
      setEditPrompt(describe.jsonDescription)
    }
  }, [describe, setEditPrompt])

  const promoteToSource = useCallback(
    async (result: GenerationResult) => {
      if (!result.url || !user?.id) return

      // Fetch metadata for the promoted image
      const { data } = await supabase
        .from('user_images')
        .select('id, title, storage_path, generation_metadata')
        .eq('id', result.id)
        .eq('user_id', user.id)
        .single()

      if (!data?.storage_path) return

      const { data: signed } = await supabase.storage
        .from('user-images')
        .createSignedUrl(data.storage_path, 86400)

      const meta = data.generation_metadata as Record<string, unknown> | null
      const srcRatio = meta?.aspect_ratio as string | undefined

      const url = signed?.signedUrl ?? result.url

      setSourceImage({
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string | undefined) ?? result.prompt ?? null,
        aspectRatio: srcRatio ?? null,
        url,
      })

      setActiveSourceId(result.id)
      setSourceChain((prev) =>
        prev.includes(result.id) ? prev : [...prev, result.id],
      )
      setEditPrompt('')

      // Update aspect ratio from promoted image
      if (srcRatio) {
        const [a, b] = srcRatio.split(':').map(Number)
        setOrientation(a >= b ? 'landscape' : 'portrait')
        setAspectRatio(srcRatio)
      } else {
        const probe = new Image()
        probe.onload = () => {
          const detected = detectAspectRatio(
            probe.naturalWidth,
            probe.naturalHeight,
          )
          const [a, b] = detected.split(':').map(Number)
          setOrientation(a >= b ? 'landscape' : 'portrait')
          setAspectRatio(detected)
        }
        probe.src = url
      }
    },
    [user?.id],
  )

  const resetToOriginal = useCallback(() => {
    if (!originalImage) return
    setSourceImage(originalImage)
    setActiveSourceId(imageId)
    setEditPrompt('')
  }, [originalImage, imageId])

  const isChained = activeSourceId !== imageId

  // Variation generation
  const [variationPrompts, setVariationPrompts] = useState<Array<string>>([])
  const [variationPromptsLoading, setVariationPromptsLoading] = useState(false)
  const [variationSubmitting, setVariationSubmitting] = useState(false)
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [variationMeta, setVariationMeta] = useState<{
    rootPrompt: string
    rootImageId: string
    sourceImageId: string
    falImageUrl?: string
  } | null>(null)

  // Reference images for variations
  const existingImages = useExistingImages(user?.id)
  const [variationRefImages, setVariationRefImages] = useState<
    Array<{ id: string; url: string; title: string }>
  >([])
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  const handleAddRefImages = useCallback((selected: Array<CollectedImage>) => {
    setVariationRefImages((prev) => {
      const existingIds = new Set(prev.map((r) => r.id))
      const newImages = selected
        .filter((img) => !existingIds.has(img.id))
        .map((img) => ({ id: img.id, url: img.url, title: img.title }))
      return [...prev, ...newImages]
    })
  }, [])

  const handleRemoveRefImage = useCallback((id: string) => {
    setVariationRefImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const handleGenerateVariations = useCallback(async () => {
    if (!accessToken || !sourceImage?.prompt) return
    setError(null)
    setVariationDialogOpen(true)
    setVariationPromptsLoading(true)
    setVariationPrompts([])

    try {
      const result = await generateVariationPrompts({
        data: {
          accessToken,
          prompt: sourceImage.prompt,
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
  }, [accessToken, sourceImage?.prompt, activeSourceId])

  const [generatingMore, setGeneratingMore] = useState(false)

  const handleGenerateMoreVariations = useCallback(async () => {
    if (!accessToken || !sourceImage?.prompt) return
    setGeneratingMore(true)
    try {
      const result = await generateVariationPrompts({
        data: {
          accessToken,
          prompt: sourceImage.prompt,
          sourceImageId: activeSourceId,
          count: 1,
          existingPrompts: variationPrompts,
        },
      })
      setVariationPrompts((prev) => [...prev, ...result.prompts])
    } catch {
      // silently fail -- user can retry
    } finally {
      setGeneratingMore(false)
    }
  }, [accessToken, sourceImage?.prompt, activeSourceId, variationPrompts])

  const handleRunVariations = useCallback(
    async (prompts: Array<string>) => {
      if (!accessToken || !variationMeta || !sourceImage) return
      const cost = CREDIT_COSTS.variation * prompts.length
      if (credits.balance !== null && credits.balance < cost) {
        credits.showInsufficientCredits(cost)
        return
      }

      setVariationSubmitting(true)
      try {
        const refIds = variationRefImages.map((r) => r.id)
        const variationResults = await submitVariations({
          data: {
            accessToken,
            prompts,
            model: 'fal-ai/flux-pro/kontext',
            sourceImageId: variationMeta.sourceImageId,
            rootImageId: variationMeta.rootImageId,
            rootPrompt: variationMeta.rootPrompt,
            aspectRatio,
            falImageUrl: variationMeta.falImageUrl,
            ...(refIds.length > 0 ? { referenceImageIds: refIds } : {}),
          },
        })
        setVariationDialogOpen(false)

        for (let i = 0; i < variationResults.length; i++) {
          results.addPendingResult({
            id: variationResults[i].recordId,
            status: 'pending',
            label: 'Kontext Pro',
            prompt: prompts[i],
          })
        }

        await credits.refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('Insufficient credits')) {
          credits.showInsufficientCredits(cost)
        } else {
          setError(message)
        }
      } finally {
        setVariationSubmitting(false)
      }
    },
    [
      accessToken,
      variationMeta,
      aspectRatio,
      credits,
      results,
      variationRefImages,
    ],
  )

  return {
    sourceImage,
    loading,
    editPrompt,
    setEditPrompt,
    editLoading,
    error,
    setError,
    orientation,
    setOrientation,
    aspectRatio,
    setAspectRatio,
    modelSelector,
    ratioOptions,
    results,
    credits,
    handleSubmit,
    handleRegenerate,
    promoteToSource,
    resetToOriginal,
    isChained,
    jsonDescription: describe.jsonDescription,
    jsonLoading: describe.jsonLoading,
    handleDescribeJson,
    variationDialogOpen,
    setVariationDialogOpen,
    variationPrompts,
    variationPromptsLoading,
    variationSubmitting,
    handleGenerateVariations,
    handleRunVariations,
    handleGenerateMoreVariations,
    generatingMore,
    hasParent,
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
    variationRefImages,
    handleAddRefImages,
    handleRemoveRefImage,
    refPickerOpen,
    setRefPickerOpen,
    existingImages,
  }
}
