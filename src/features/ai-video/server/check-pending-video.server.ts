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

      const status = await fal.queue.status(model, {
        requestId: record.request_id,
        logs: false,
      })

      if (status.status !== 'COMPLETED') {
        return { status: 'pending' as const }
      }

      const result = await fal.queue.result(model, {
        requestId: record.request_id,
      })

      const videoUrl = (result.data as { video?: { url?: string } }).video?.url
      if (!videoUrl) {
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
      await supabase
        .from('user_images')
        .update({
          status: 'failed',
          generation_error:
            error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', record.id)

      return {
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
