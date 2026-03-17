import { task } from '@trigger.dev/sdk/v3'
import { getSupabaseAdmin } from './lib/supabase-admin'
import { pollFalResult } from './lib/fal-poller'
import { downloadAndStoreImage } from './lib/image-storage'

interface ProcessFalImagePayload {
  recordId: string
  userId: string
  falModelId: string
  requestId: string
}

export const processFalImage = task({
  id: 'process-fal-image',
  run: async (payload: ProcessFalImagePayload) => {
    const { recordId, userId, falModelId, requestId } = payload
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

      const imageUrl = (result.data as { images?: Array<{ url?: string }> })
        .images?.[0]?.url
      if (!imageUrl) {
        throw new Error('No image URL in FAL result')
      }

      const { storagePath, fileName, fileHash, fileSize } =
        await downloadAndStoreImage(supabase, userId, imageUrl)

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
      const prompt = typeof meta.prompt === 'string' ? meta.prompt : ''
      const model = typeof meta.model === 'string' ? meta.model : falModelId

      const { error: updateError } = await supabase
        .from('user_images')
        .update({
          status: 'completed',
          storage_path: storagePath,
          file_name: fileName,
          file_hash: fileHash,
          file_size: fileSize,
          mime_type: 'image/png',
          title: model,
          description:
            prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt,
          generation_metadata: {
            ...meta,
            seed: result.data.seed,
            timings: result.data.timings,
            completed_at: new Date().toISOString(),
          },
        })
        .eq('id', recordId)

      if (updateError) {
        // Rollback: delete uploaded file
        await supabase.storage.from('user-images').remove([storagePath])
        throw new Error(`Update failed: ${updateError.message}`)
      }

      return { status: 'completed', storagePath }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(
        `[process-fal-image] Failed for record=${recordId}: ${errorMsg}`,
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
