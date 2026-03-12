import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const LEGACY_VIDEO_MODEL = 'fal-ai/kling-video/o1/image-to-video'

interface CheckPendingVideoInput {
  accessToken: string
  recordId: string
}

export const checkPendingVideo = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckPendingVideoInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: record } = await supabase
      .from('user_images')
      .select('*')
      .eq('id', data.recordId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (!record) {
      return { status: 'not_found' as const }
    }

    try {
      const model =
        (record.generation_metadata as { model?: string } | null)?.model ||
        LEGACY_VIDEO_MODEL

      let queueStatus
      try {
        queueStatus = await fal.queue.status(model, {
          requestId: record.request_id,
          logs: true,
        })
      } catch (statusErr) {
        console.error(
          `[video-check] status() threw for model=${model} requestId=${record.request_id}: ${statusErr instanceof Error ? statusErr.message : statusErr}`,
        )
        throw statusErr
      }

      if (queueStatus.status !== 'COMPLETED') {
        return { status: 'pending' as const }
      }

      let result
      try {
        result = await fal.queue.result(model, {
          requestId: record.request_id,
        })
      } catch (resultErr) {
        console.error(
          `[video-check] result() threw for model=${model} requestId=${record.request_id}: ${resultErr instanceof Error ? resultErr.message : resultErr}`,
        )
        throw resultErr
      }

      const videoUrl = (result.data as { video?: { url?: string } }).video?.url
      if (!videoUrl) {
        console.error(
          `[video-check] No video URL in result. model=${model} keys=${JSON.stringify(Object.keys(result.data as object))} data=${JSON.stringify(result.data).slice(0, 500)}`,
        )
        throw new Error('No video URL in FAL result')
      }

      // Store the FAL CDN URL directly — no download/re-upload needed
      const { error: updateError } = await supabase
        .from('user_images')
        .update({
          status: 'completed',
          title: 'Generated video',
          generation_metadata: {
            ...record.generation_metadata,
            fal_url: videoUrl,
            completed_at: new Date().toISOString(),
          },
        })
        .eq('id', record.id)

      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`)
      }

      return { status: 'completed' as const, videoUrl }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(
        `[video-check] Error for record=${record.id} model=${(record.generation_metadata as { model?: string } | null)?.model}: ${errorMsg}`,
      )
      await supabase
        .from('user_images')
        .update({
          status: 'failed',
          generation_error: errorMsg,
        })
        .eq('id', record.id)

      return {
        status: 'error' as const,
        error: errorMsg,
      }
    }
  })
