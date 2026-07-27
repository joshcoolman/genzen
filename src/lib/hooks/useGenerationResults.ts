'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from '@/lib/types/generation-result'
import type { Tables } from '@/lib/types/supabase'
import type { SavedAiImage } from '@/features/ai-images/types'
import {
  listGenerationResultRows,
  trashGenerationResult,
} from '@/features/ai-images/server/edit.actions'
import { getModelName } from '@/features/ai-images/models'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { createImageStorage } from '@/lib/image-storage'

const DEFAULT_LIMIT = 50

interface UseGenerationResultsOptions {
  userId: string | undefined
  generationType: string | Array<string>
  limit?: number
  sourceImageIds?: Array<string>
}

function getMetadata(
  value: Tables<'user_images'>['generation_metadata'],
): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function inferModelId(meta: Record<string, unknown>): string {
  const falId = meta.fal_model_id as string | undefined
  if (falId) return falId
  const model = meta.model as string | undefined
  if (model) return model
  return 'unknown'
}

export function useGenerationResults({
  userId,
  generationType,
  limit = DEFAULT_LIMIT,
  sourceImageIds,
}: UseGenerationResultsOptions) {
  const [results, setResults] = useState<Array<GenerationResult>>([])
  const [savedImages, setSavedImages] = useState<Array<SavedAiImage>>([])
  const [savedImageUrls, setSavedImageUrls] = useState<Record<string, string>>(
    {},
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load recent results from DB. Called on mount and again whenever a poll
  // settles a pending row (see the polling effect below).
  const reload = useCallback(
    async function load() {
      if (!userId) return

      const rows = await listGenerationResultRows({
        generationType,
        limit,
        sourceImageIds,
      }).catch(() => null)

      if (!rows || rows.length === 0) return

      const urlMap: Record<string, string> = {}
      await Promise.all(
        rows
          .filter((r) => r.status === 'completed' && r.storage_path)
          .map(async (r) => {
            const path = r.thumbnail_path ?? r.storage_path!
            const url = await createImageStorage().getUrl(path)
            if (url) urlMap[r.id] = url
          }),
      )

      const loaded: Array<GenerationResult> = rows.map((r) => {
        const meta = getMetadata(r.generation_metadata) ?? {}
        const modelId = inferModelId(meta)
        const status =
          r.status === 'completed'
            ? 'complete'
            : r.status === 'failed'
              ? 'failed'
              : 'pending'
        return {
          id: r.id,
          status,
          label: getModelName(modelId),
          url: urlMap[r.id],
          storagePath: r.storage_path ?? undefined,
          prompt: (meta.prompt as string | undefined) ?? undefined,
          enhancedPrompt:
            (meta.enhanced_prompt as string | undefined) ?? undefined,
          originalPrompt:
            (meta.original_prompt as string | undefined) ?? undefined,
          title: r.title,
          fileSize: r.file_size ?? undefined,
          createdAt: r.created_at,
        }
      })

      const loadedSaved: Array<SavedAiImage> = rows.map((r) => {
        const meta = getMetadata(r.generation_metadata) ?? {}
        return {
          id: r.id,
          title: r.title,
          storage_path: r.storage_path ?? null,
          thumbnail_path: r.thumbnail_path ?? null,
          status: r.status as SavedAiImage['status'],
          generation_error: null,
          generation_metadata: {
            prompt: (meta.prompt as string | undefined) ?? '',
            model: inferModelId(meta),
            generation_type:
              (meta.generation_type as string | undefined) ?? undefined,
            source_image_id:
              (meta.source_image_id as string | undefined) ?? undefined,
            root_image_id:
              (meta.root_image_id as string | undefined) ?? undefined,
            aspect_ratio:
              (meta.aspect_ratio as string | undefined) ?? undefined,
          },
          created_at: r.created_at,
        }
      })

      setResults(loaded)
      setSavedImages(loadedSaved)
      setSavedImageUrls(urlMap)
    },
    [userId, JSON.stringify(generationType), limit, sourceImageIds?.join(',')],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  // Poll FAL for pending generations (skipped when webhooks are enabled)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (process.env.VITE_ENABLE_FAL_WEBHOOKS === 'true') return
    const hasPending = results.some((r) => r.status === 'pending')

    // The poll settles rows server-side; a settled row means this list is
    // stale. Realtime no longer delivers those UPDATEs (#174), so refetch here.
    const pollOnce = () =>
      checkPendingGenerations()
        .then((result) => {
          if (result.completed === 0 && result.failed === 0) return
          return reload()
        })
        .catch(() => {})

    if (hasPending && !pollingRef.current) {
      void pollOnce()
      pollingRef.current = setInterval(() => {
        void pollOnce()
      }, 5000)
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [results.some((r) => r.status === 'pending')])

  const addPendingResult = useCallback((result: GenerationResult) => {
    setResults((prev) => [result, ...prev])
    setSavedImages((prev) => [
      {
        id: result.id,
        title: result.title ?? result.label,
        storage_path: null,
        status: 'pending' as const,
        generation_error: null,
        generation_metadata: {
          prompt: result.prompt ?? '',
          model: result.label,
        },
        created_at: result.createdAt ?? new Date().toISOString(),
      },
      ...prev,
    ])
  }, [])

  const replaceTempId = useCallback((tempId: string, realId: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === tempId ? { ...r, id: realId } : r)),
    )
    // savedImages is keyed by the same id and drives the cards; leaving the
    // temp id here meant the row the pollers later update never matched.
    setSavedImages((prev) =>
      prev.map((r) => (r.id === tempId ? { ...r, id: realId } : r)),
    )
  }, [])

  /**
   * Flip an optimistic tile to failed with a reason. Used when the submit
   * itself throws, so a click always leaves something on the board rather than
   * a tile that spins forever or silently disappears.
   */
  const failResult = useCallback((id: string, message: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'failed' as const } : r)),
    )
    setSavedImages((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: 'failed' as const, generation_error: message }
          : r,
      ),
    )
  }, [])

  const deleteResult = useCallback(async (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
    setSavedImages((prev) => prev.filter((r) => r.id !== id))
    setSavedImageUrls((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await trashGenerationResult(id)
  }, [])

  const dismissResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
    setSavedImages((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return {
    results,
    savedImages,
    savedImageUrls,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    addPendingResult,
    replaceTempId,
    failResult,
    deleteResult,
    dismissResult,
  }
}
