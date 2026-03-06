import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from '@/lib/types/generation-result'
import { supabase } from '@/lib/supabase'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { getModelName } from '@/features/ai-images/models'

const DEFAULT_LIMIT = 50

interface UseGenerationResultsOptions {
  userId: string | undefined
  accessToken: string
  generationType: string
  limit?: number
}

interface DbRow {
  id: string
  storage_path: string | null
  status: string
  generation_metadata: Record<string, unknown> | null
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
  generationType: string,
): boolean {
  return (
    row.generation_metadata !== null &&
    typeof row.generation_metadata === 'object' &&
    (row.generation_metadata as Record<string, unknown>).generation_type ===
      generationType
  )
}

export function useGenerationResults({
  userId,
  accessToken,
  generationType,
  limit = DEFAULT_LIMIT,
}: UseGenerationResultsOptions) {
  const [results, setResults] = useState<Array<GenerationResult>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resultsRef = useRef(results)
  useEffect(() => {
    resultsRef.current = results
  }, [results])

  // Load recent results from DB on mount
  useEffect(() => {
    if (!userId) return

    async function load() {
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select('id, storage_path, status, generation_metadata')
        .eq('user_id', userId!)
        .eq('source', 'ai_generated')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (queryError ?? !data) return

      const rows = (data as Array<DbRow>).filter((r) =>
        matchesType(r, generationType),
      )
      if (rows.length === 0) return

      const urlMap: Record<string, string> = {}
      await Promise.all(
        rows
          .filter((r) => r.status === 'completed' && r.storage_path)
          .map(async (r) => {
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(r.storage_path!, 3600)
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
        }
      })

      setResults(loaded)
    }

    void load()
  }, [userId, generationType, limit])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`gen_results_${generationType}`)
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
            if (!matchesType(updated, generationType)) return

            if (updated.status === 'completed' && updated.storage_path) {
              supabase.storage
                .from('user-images')
                .createSignedUrl(updated.storage_path, 3600)
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
  }, [userId, generationType])

  // Background polling for pending records
  useEffect(() => {
    if (!accessToken) return

    const interval = setInterval(async () => {
      const pendingIds = resultsRef.current
        .filter((r) => r.status === 'pending')
        .map((r) => r.id)

      if (pendingIds.length === 0) return

      try {
        await checkPendingImages({
          data: { accessToken, recordIds: pendingIds },
        })
      } catch (err) {
        console.error(`${generationType} poll error:`, err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [accessToken, generationType])

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

  return {
    results,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    addPendingResult,
    replaceTempId,
    deleteResult,
  }
}
