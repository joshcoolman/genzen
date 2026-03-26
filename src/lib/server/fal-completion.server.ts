import { downloadAndStoreImage } from './image-storage.server'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function processImageResult(
  supabase: SupabaseClient,
  recordId: string,
  userId: string,
  falResultData: Record<string, unknown>,
) {
  const imageUrl = (falResultData as { images?: Array<{ url?: string }> })
    .images?.[0]?.url
  if (!imageUrl) {
    throw new Error('No image URL in FAL result')
  }

  const { storagePath, thumbnailPath, fileName, fileHash, fileSize } =
    await downloadAndStoreImage(supabase, userId, imageUrl)

  // Fetch current metadata to merge
  const { data: record } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('id', recordId)
    .single()

  const meta = (record?.generation_metadata ?? {}) as Record<string, unknown>
  const prompt = typeof meta.prompt === 'string' ? meta.prompt : ''
  const model =
    typeof meta.model === 'string'
      ? meta.model
      : typeof meta.fal_model_id === 'string'
        ? meta.fal_model_id
        : ''

  const { error: updateError } = await supabase
    .from('user_images')
    .update({
      status: 'completed',
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      file_name: fileName,
      file_hash: fileHash,
      file_size: fileSize,
      mime_type: 'image/png',
      title: model,
      description:
        prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt,
      generation_metadata: {
        ...meta,
        seed: falResultData.seed,
        timings: falResultData.timings,
        completed_at: new Date().toISOString(),
      },
    })
    .eq('id', recordId)

  if (updateError) {
    await supabase.storage.from('user-images').remove([storagePath])
    throw new Error(`Update failed: ${updateError.message}`)
  }
}

export async function processVideoResult(
  supabase: SupabaseClient,
  recordId: string,
  falResultData: Record<string, unknown>,
) {
  const videoUrl = (falResultData as { video?: { url?: string } }).video?.url
  if (!videoUrl) {
    throw new Error('No video URL in FAL result')
  }

  const { data: record } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('id', recordId)
    .single()

  const meta = (record?.generation_metadata ?? {}) as Record<string, unknown>

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
}

export async function markGenerationFailed(
  supabase: SupabaseClient,
  recordId: string,
  errorMsg: string,
) {
  await supabase
    .from('user_images')
    .update({
      status: 'failed',
      generation_error: errorMsg,
    })
    .eq('id', recordId)
}
