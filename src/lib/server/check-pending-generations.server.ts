import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from './auth.server'
import { getSupabaseAdmin } from './supabase-admin.server'
import {
  markGenerationFailed,
  processImageResult,
  processVideoResult,
} from './fal-completion.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface CheckPendingInput {
  accessToken: string
}

export const checkPendingGenerations = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckPendingInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const supabase = getSupabaseAdmin()

    // Fetch all pending records with a request_id
    const { data: pending, error: queryError } = (await supabase
      .from('user_images')
      .select('id, source, request_id, generation_metadata')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .not('request_id', 'is', null)) as {
      data: Array<{
        id: string
        source: string
        request_id: string
        generation_metadata: Record<string, unknown> | null
      }> | null
      error: { message: string } | null
    }

    if (queryError || !pending || pending.length === 0) {
      return { checked: 0, completed: 0, failed: 0 }
    }

    let completed = 0
    let failed = 0

    await Promise.all(
      pending.map(async (record) => {
        const meta = record.generation_metadata ?? {}
        const falModelId =
          (meta.fal_model_id as string | undefined) ??
          (meta.model as string | undefined)
        if (!falModelId || !record.request_id) return

        try {
          const status = await fal.queue.status(falModelId, {
            requestId: record.request_id,
            logs: false,
          })

          if (status.status === 'COMPLETED') {
            const result = (await fal.queue.result(falModelId, {
              requestId: record.request_id,
            })) as { data: Record<string, unknown> }

            const isVideo = record.source === 'ai_video'
            if (isVideo) {
              await processVideoResult(supabase, record.id, result.data)
            } else {
              await processImageResult(
                supabase,
                record.id,
                user.id,
                result.data,
              )
            }
            completed++
          } else {
            const statusStr = status.status as string
            if (statusStr !== 'IN_QUEUE' && statusStr !== 'IN_PROGRESS') {
              await markGenerationFailed(
                supabase,
                record.id,
                `FAL job ${statusStr}`,
              )
              failed++
            }
            // IN_QUEUE / IN_PROGRESS — still waiting, skip
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          console.error(
            `[check-pending] Failed for record=${record.id}: ${msg}`,
          )
          await markGenerationFailed(supabase, record.id, msg)
          failed++
        }
      }),
    )

    return { checked: pending.length, completed, failed }
  })
