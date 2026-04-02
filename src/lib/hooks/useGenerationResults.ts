import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from '@/lib/types/generation-result'
import type { Tables } from '@/lib/types/supabase'
import type { SavedAiImage } from '@/features/ai-images/types'
import { supabase } from '@/lib/supabase'
import { getModelName } from '@/features/ai-images/models'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'
import { createImageStorage } from '@/lib/image-storage'

const DEFAULT_LIMIT = 50

interface UseGenerationResultsOptions {
  userId: string | undefined
  accessToken: string
  generationType: string | Array<string>
  limit?: number
  sourceImageIds?: Array<string>
}

type DbRow = Pick<
  Tables<'user_images'>,
  | 'id'
  | 'storage_path'
  | 'thumbnail_path'
  | 'status'
  | 'generation_metadata'
  | 'title'
  | 'file_size'
  | 'created_at'
>

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

function matchesType(
  row: { generation_metadata: unknown },
  generationType: string | Array<string>,
): boolean {
  if (
    row.generation_metadata === null ||
    typeof row.generation_metadata !== 'object'
  )
    return false
  const type = (row.generation_metadata as Record<string, unknown>)
    .generation_type as string | undefined
  if (!type) return false
  return Array.isArray(generationType)
    ? generationType.includes(type)
    : type === generationType
}

export function useGenerationResults({
  userId,
  accessToken,
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

  // Load recent results from DB on mount
  useEffect(() => {
    if (!userId) return

    async function load() {
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select(
          'id, storage_path, thumbnail_path, status, generation_metadata, title, file_size, created_at',
        )
        .eq('user_id', userId!)
        .in('source', ['upload', 'ai_generated'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (queryError) return

      const rows = (data as Array<DbRow>).filter((r) => {
        if (sourceImageIds && sourceImageIds.length > 0) {
          // When filtering by source chain, include any image whose
          // parent_id is in the chain (group membership).
          // Note: source_image_id is immutable (true generation history),
          // parent_id is mutable (organizational grouping).
          const meta = getMetadata(r.generation_metadata)
          const parentId = meta?.parent_id as string | undefined
          if (!parentId || !sourceImageIds.includes(parentId)) return false
        } else {
          if (!matchesType(r, generationType)) return false
        }
        return true
      })
      if (rows.length === 0) return

      const urlMap: Record<string, string> = {}
      await Promise.all(
        rows
          .filter((r) => r.status === 'completed' && r.storage_path)
          .map(async (r) => {
            const path = r.thumbnail_path ?? r.storage_path!
            const url = await createImageStorage(supabase).getUrl(path)
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
    }

    void load()
  }, [userId, JSON.stringify(generationType), limit, sourceImageIds?.join(',')])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channelKey = sourceImageIds?.length ? sourceImageIds.join('_') : 'all'
    const typeKey = Array.isArray(generationType)
      ? generationType.join('_')
      : generationType
    const channel = supabase
      .channel(`gen_results_${typeKey}_${channelKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as DbRow
            if (sourceImageIds && sourceImageIds.length > 0) {
              const meta = getMetadata(updated.generation_metadata)
              // Use parent_id for group filtering (mutable organizational parent)
              const parentId = meta?.parent_id as string | undefined
              if (!parentId || !sourceImageIds.includes(parentId)) return
            } else {
              if (!matchesType(updated, generationType)) return
            }

            if (updated.status === 'completed' && updated.storage_path) {
              const meta = getMetadata(updated.generation_metadata) ?? {}
              const modelId = inferModelId(meta)
              const thumbPath = updated.thumbnail_path
              createImageStorage(supabase)
                .getUrl(thumbPath ?? updated.storage_path)
                .then((url) => {
                  if (url) {
                    setResults((prev) =>
                      prev.map((r) =>
                        r.id === updated.id
                          ? {
                              ...r,
                              status: 'complete' as const,
                              url,
                              storagePath:
                                updated.storage_path ?? r.storagePath,
                              title: updated.title,
                              label: getModelName(modelId),
                              fileSize: updated.file_size ?? r.fileSize,
                              createdAt: updated.created_at,
                              prompt:
                                (meta.prompt as string | undefined) ?? r.prompt,
                              enhancedPrompt:
                                (meta.enhanced_prompt as string | undefined) ??
                                r.enhancedPrompt,
                              originalPrompt:
                                (meta.original_prompt as string | undefined) ??
                                r.originalPrompt,
                            }
                          : r,
                      ),
                    )
                    setSavedImages((prev) =>
                      prev.map((r) =>
                        r.id === updated.id
                          ? {
                              ...r,
                              status: 'completed' as const,
                              storage_path:
                                updated.storage_path ?? r.storage_path,
                              thumbnail_path: thumbPath ?? r.thumbnail_path,
                              title: updated.title,
                              generation_metadata: r.generation_metadata
                                ? {
                                    ...r.generation_metadata,
                                    prompt:
                                      (meta.prompt as string | undefined) ??
                                      r.generation_metadata.prompt,
                                  }
                                : r.generation_metadata,
                            }
                          : r,
                      ),
                    )
                    setSavedImageUrls((prev) => ({
                      ...prev,
                      [updated.id]: url,
                    }))
                  }
                })
                .catch(() => {})
            } else if (updated.status === 'failed') {
              setResults((prev) =>
                prev.map((r) =>
                  r.id === updated.id ? { ...r, status: 'failed' } : r,
                ),
              )
              setSavedImages((prev) =>
                prev.map((r) =>
                  r.id === updated.id ? { ...r, status: 'failed' as const } : r,
                ),
              )
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, JSON.stringify(generationType), sourceImageIds?.join(',')])

  // Poll FAL for pending generations (skipped when webhooks are enabled)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_FAL_WEBHOOKS === 'true') return
    const hasPending = results.some((r) => r.status === 'pending')

    if (hasPending && accessToken && !pollingRef.current) {
      checkPendingGenerations({ data: { accessToken } }).catch(() => {})
      pollingRef.current = setInterval(() => {
        checkPendingGenerations({ data: { accessToken } }).catch(() => {})
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
  }, [accessToken, results.some((r) => r.status === 'pending')])

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
  }, [])

  const deleteResult = useCallback(async (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
    setSavedImages((prev) => prev.filter((r) => r.id !== id))
    setSavedImageUrls((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await supabase
      .from('user_images')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
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
    deleteResult,
    dismissResult,
  }
}
