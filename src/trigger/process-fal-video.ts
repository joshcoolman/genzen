import { task } from '@trigger.dev/sdk/v3'
import { getSupabaseAdmin } from './lib/supabase-admin'
import { pollFalResult } from './lib/fal-poller'

interface ProcessFalVideoPayload {
  recordId: string
  userId: string
  falModelId: string
  requestId: string
}

export const processFalVideo = task({
  id: 'process-fal-video',
  run: async (payload: ProcessFalVideoPayload) => {
    const { recordId, falModelId, requestId } = payload
    const supabase = getSupabaseAdmin()

    // Idempotent: skip if already completed
    const { data: existing } = await supabase
      .from('user_images')
      .select('status')
      .eq('id', recordId)
      .single()

    if (existing?.status === 'completed') {
      return { status: 'already_completed' }
    }

    try {
      const result = await pollFalResult(falModelId, requestId)

      const videoUrl = (result.data as { video?: { url?: string } }).video?.url
      if (!videoUrl) {
        throw new Error('No video URL in FAL result')
      }

      // Fetch current metadata to merge
      const { data: record } = await supabase
        .from('user_images')
        .select('generation_metadata')
        .eq('id', recordId)
        .single()

      const meta = (record?.generation_metadata ?? {}) as Record<
        string,
        unknown
      >

      const { error: updateError } = await supabase
        .from('user_images')
        .update({
          status: 'completed',
          title: 'Generated video',
          generation_metadata: {
            ...meta,
            fal_url: videoUrl,
            completed_at: new Date().toISOString(),
          },
        })
        .eq('id', recordId)

      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`)
      }

      return { status: 'completed', videoUrl }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(
        `[process-fal-video] Failed for record=${recordId}: ${errorMsg}`,
      )

      await supabase
        .from('user_images')
        .update({
          status: 'failed',
          generation_error: errorMsg,
        })
        .eq('id', recordId)

      throw error
    }
  },
})
