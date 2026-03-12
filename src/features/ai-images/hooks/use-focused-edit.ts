import { useCallback, useEffect, useState } from 'react'
import type { GenerationResult } from '@/lib/types/generation-result'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { CREDIT_COSTS } from '@/features/credits'
import {
  detectAspectRatio,
  getRatioOptions,
} from '@/features/ai-images/constants'
import { DEFAULT_EDIT_MODEL, EDIT_MODELS } from '@/features/ai-images/models'
import { supabase } from '@/lib/supabase'

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
  const credits = useCredits()

  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [originalImage, setOriginalImage] = useState<SourceImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editPrompt, setEditPrompt] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [editModelId, setEditModelId] = useState(DEFAULT_EDIT_MODEL)

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

      // Build parent -> children map from all edit images
      const childrenOf: Record<string, Array<string>> = {}
      for (const row of data) {
        const meta = row.generation_metadata as Record<string, unknown> | null
        if (
          meta?.generation_type === 'edit' &&
          typeof meta?.source_image_id === 'string'
        ) {
          const srcId = meta.source_image_id
          if (!childrenOf[srcId]) childrenOf[srcId] = []
          childrenOf[srcId].push(row.id)
        }
      }

      // BFS from root imageId to find all descendants
      const chain = [imageId]
      const visited = new Set([imageId])
      const queue = [imageId]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const childId of childrenOf[current] ?? []) {
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
    generationType: 'edit',
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
        .createSignedUrl(data.storage_path, 3600)

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
        prompt: (meta?.prompt as string) ?? null,
        aspectRatio: srcRatio ?? null,
        url: signed.signedUrl,
      }

      setSourceImage(src)
      setOriginalImage(src)

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
    if (!editPrompt.trim() || !accessToken || editLoading) return
    setEditLoading(true)
    setError(null)
    try {
      await credits.deduct(CREDIT_COSTS.edit, 'edit')
      const { recordId } = await editImage({
        data: {
          accessToken,
          sourceImageId: activeSourceId,
          editPrompt: editPrompt.trim(),
          aspectRatio,
          editModelId,
        },
      })

      results.addPendingResult({
        id: recordId,
        status: 'pending',
        label:
          EDIT_MODELS.find((m) => m.id === editModelId)?.name ?? editModelId,
        prompt: editPrompt.trim(),
      })

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
    editModelId,
    credits,
    results,
  ])

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
        .createSignedUrl(data.storage_path, 3600)

      const meta = data.generation_metadata as Record<string, unknown> | null
      const srcRatio = meta?.aspect_ratio as string | undefined

      const url = signed?.signedUrl ?? result.url

      setSourceImage({
        id: data.id,
        title: data.title,
        storagePath: data.storage_path,
        prompt: (meta?.prompt as string) ?? result.prompt ?? null,
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
    editModelId,
    setEditModelId,
    ratioOptions,
    results,
    credits,
    handleSubmit,
    handleRegenerate,
    promoteToSource,
    resetToOriginal,
    isChained,
  }
}
