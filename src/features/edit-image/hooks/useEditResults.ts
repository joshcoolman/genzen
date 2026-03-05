import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditResult } from '../types'
import { supabase } from '@/lib/supabase'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { getModelName } from '@/features/ai-images/models'

const RECENT_LIMIT = 50

interface SubmitParams {
  accessToken: string
  sourceImageId: string
  editPrompt: string
  aspectRatio: string
  referenceImageIds: Array<string>
  modelIds: Array<string>
  generationsPerModel: number
}

interface UseEditResultsOptions {
  userId: string | undefined
  accessToken: string
}

interface DbEditRow {
  id: string
  storage_path: string | null
  status: string
  generation_metadata: Record<string, unknown> | null
}

function inferModelId(meta: Record<string, unknown>): string {
  const falId = meta.fal_model_id as string | undefined
  if (falId) return falId
  const model = meta.model as string | undefined
  if (model) return model.endsWith('/edit') ? model : `${model}/edit`
  return 'unknown'
}

function isEditRow(row: { generation_metadata: unknown }): boolean {
  return (
    row.generation_metadata !== null &&
    typeof row.generation_metadata === 'object' &&
    (row.generation_metadata as Record<string, unknown>).generation_type ===
      'edit'
  )
}

export function useEditResults({ userId, accessToken }: UseEditResultsOptions) {
  const [results, setResults] = useState<Array<EditResult>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable ref so interval can read latest results without being a dep
  const resultsRef = useRef(results)
  useEffect(() => {
    resultsRef.current = results
  }, [results])

  // Load recent edit results from DB on mount
  useEffect(() => {
    if (!userId) return

    async function load() {
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select('id, storage_path, status, generation_metadata')
        .eq('user_id', userId)
        .eq('source', 'ai_generated')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT)

      if (queryError ?? !data) return

      const editRows = (data as Array<DbEditRow>).filter(isEditRow)
      if (editRows.length === 0) return

      // Resolve signed URLs for completed rows
      const urlMap: Record<string, string> = {}
      await Promise.all(
        editRows
          .filter((r) => r.status === 'completed' && r.storage_path)
          .map(async (r) => {
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(r.storage_path!, 3600)
            if (signed) urlMap[r.id] = signed.signedUrl
          }),
      )

      const loaded: Array<EditResult> = editRows.map((r) => {
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
          modelName: getModelName(modelId),
          modelId,
          url: urlMap[r.id],
        }
      })

      setResults(loaded)
    }

    void load()
  }, [userId])

  // Realtime subscription — mirrors use-images.ts pattern
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('edit_image_changes')
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
            const updated = payload.new as DbEditRow
            if (!isEditRow(updated)) return

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
  }, [userId])

  // Background polling — mirrors use-images.ts: fire-and-forget, Realtime drives UI
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
        console.error('Edit poll error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [accessToken])

  const submit = useCallback(async (params: SubmitParams) => {
    if (!params.editPrompt.trim()) {
      setError('Enter a prompt before generating.')
      return
    }
    if (!params.sourceImageId) {
      setError('Select a source image first.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    const pairs: Array<{ modelId: string; gen: number }> = []
    for (const modelId of params.modelIds) {
      for (let g = 0; g < params.generationsPerModel; g++) {
        pairs.push({ modelId, gen: g })
      }
    }

    // Optimistically add pending entries
    const tempIds = pairs.map((_, i) => `temp-${Date.now()}-${i}`)
    const pendingEntries: Array<EditResult> = pairs.map((p, i) => ({
      id: tempIds[i],
      status: 'pending',
      modelName: getModelName(p.modelId),
      modelId: p.modelId,
    }))
    setResults((prev) => [...pendingEntries, ...prev])

    try {
      const submissions = await Promise.allSettled(
        pairs.map((p) =>
          editImage({
            data: {
              accessToken: params.accessToken,
              sourceImageId: params.sourceImageId,
              editPrompt: params.editPrompt,
              aspectRatio: params.aspectRatio,
              editModelId: p.modelId,
              referenceImageIds: params.referenceImageIds,
              numImages: 1,
            },
          }),
        ),
      )

      // Replace temp IDs with real DB record IDs
      setResults((prev) => {
        const next = [...prev]
        let tempIdx = 0
        for (let i = 0; i < next.length; i++) {
          if (tempIds.includes(next[i].id)) {
            const submission = submissions[tempIdx]
            if (submission.status === 'fulfilled') {
              next[i] = { ...next[i], id: submission.value.recordId }
            } else {
              next[i] = { ...next[i], status: 'failed' }
            }
            tempIdx++
          }
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setResults((prev) =>
        prev.map((r) =>
          tempIds.includes(r.id) ? { ...r, status: 'failed' } : r,
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return { results, isSubmitting, error, submit }
}
