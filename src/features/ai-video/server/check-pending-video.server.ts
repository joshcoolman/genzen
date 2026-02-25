import crypto from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const VIDEO_MODEL = 'fal-ai/wan-flf2v'

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
      const status = await fal.queue.status(VIDEO_MODEL, {
        requestId: record.request_id,
        logs: false,
      })

      if (status.status !== 'COMPLETED') {
        return { status: 'pending' as const }
      }

      const result = await fal.queue.result(VIDEO_MODEL, {
        requestId: record.request_id,
      })

      const videoUrl = (result.data as { video?: { url?: string } }).video?.url
      if (!videoUrl) {
        throw new Error('No video URL in FAL result')
      }

      // Download the MP4
      const videoResponse = await fetch(videoUrl)
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.statusText}`)
      }

      const videoBuffer = await videoResponse.arrayBuffer()
      const videoBytes = new Uint8Array(videoBuffer)

      const hashBuffer = crypto
        .createHash('sha256')
        .update(videoBytes)
        .digest('hex')

      const timestamp = Date.now()
      const uuid = crypto.randomUUID()
      const fileName = `video_${timestamp}_${uuid}.mp4`
      const storagePath = `${user.id}/videos/${fileName}`

      // Upload to Supabase storage under ${userId}/videos/
      const { error: uploadError } = await supabase.storage
        .from('user-images')
        .upload(storagePath, videoBytes, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      const { error: updateError } = await supabase
        .from('user_images')
        .update({
          status: 'completed',
          storage_path: storagePath,
          file_name: fileName,
          file_hash: hashBuffer,
          file_size: videoBytes.length,
          mime_type: 'video/mp4',
          title: 'Generated video',
          generation_metadata: {
            ...record.generation_metadata,
            completed_at: new Date().toISOString(),
          },
        })
        .eq('id', record.id)

      if (updateError) {
        await supabase.storage.from('user-images').remove([storagePath])
        throw new Error(`Update failed: ${updateError.message}`)
      }

      return { status: 'completed' as const, storagePath }
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
