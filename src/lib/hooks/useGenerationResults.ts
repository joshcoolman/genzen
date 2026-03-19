import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from '@/lib/types/generation-result'
import { supabase } from '@/lib/supabase'
import { getModelName } from '@/features/ai-images/models'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

const DEFAULT_LIMIT = 50

interface UseGenerationResultsOptions {
  userId: string | undefined
  accessToken: string
  generationType: string | Array<string>
  limit?: number
  sourceImageIds?: Array<string>
}

interface DbRow {
  id: string
  storage_path: string | null
  status: string
  generation_metadata: Record<string, unknown> | null
  title: string | null
  file_size: number | null
  created_at: string | null
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load recent results from DB on mount
  useEffect(() => {
    if (!userId) return

    async function load() {
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select(
          'id, storage_path, status, generation_metadata, title, file_size, created_at',
        )
        .eq('user_id', userId!)
        .eq('source', 'ai_generated')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (queryError ?? !data) return

      const rows = (data as Array<DbRow>).filter((r) => {
        if (sourceImageIds && sourceImageIds.length > 0) {
          // When filtering by source chain, include any image whose
          // source_image_id is in the chain (regardless of generation_type).
          // This ensures re-parented images appear even without edit/variation type.
          const meta = r.generation_metadata
          const srcId = meta?.source_image_id as string | undefined
          if (!srcId || !sourceImageIds.includes(srcId)) return false
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
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(r.storage_path!, 86400, {
                transform: { width: 400, resize: 'contain', quality: 80 },
              })
            if (signed) urlMap[r.id] = signed.signedUrl
          }),
      )

      const loaded: Array<GenerationResult> = rows.map((r) => {
        const meta = r.generation_metadata ?? {}
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
          prompt: (meta.prompt as string | undefined) ?? undefined,
          enhancedPrompt:
            (meta.enhanced_prompt as string | undefined) ?? undefined,
          originalPrompt:
            (meta.original_prompt as string | undefined) ?? undefined,
          title: r.title ?? undefined,
          fileSize: r.file_size ?? undefined,
          createdAt: r.created_at ?? undefined,
        }
      })

      setResults(loaded)
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
              const meta = updated.generation_metadata
              const srcId = meta?.source_image_id as string | undefined
              if (!srcId || !sourceImageIds.includes(srcId)) return
            } else {
              if (!matchesType(updated, generationType)) return
            }

            if (updated.status === 'completed' && updated.storage_path) {
              supabase.storage
                .from('user-images')
                .createSignedUrl(updated.storage_path, 86400, {
                  transform: { width: 400, resize: 'contain', quality: 80 },
                })
                .then(({ data }) => {
                  if (data) {
                    setResults((prev) =>
                      prev.map((r) =>
                        r.id === updated.id
                          ? { ...r, status: 'complete', url: data.signedUrl }
                          : r,
                      ),
                    )
                  }
                })
                .catch(() => {})
            } else if (updated.status === 'failed') {
              setResults((prev) =>
                prev.map((r) =>
                  r.id === updated.id ? { ...r, status: 'failed' } : r,
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

  // Poll FAL for pending generations
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
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
  }, [])

  const replaceTempId = useCallback((tempId: string, realId: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === tempId ? { ...r, id: realId } : r)),
    )
  }, [])

  const deleteResult = useCallback(async (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
    await supabase
      .from('user_images')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  const dismissResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return {
    results,
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
