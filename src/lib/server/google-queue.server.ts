import crypto from 'node:crypto'
import { editWithGoogle, generateWithGoogle } from './google-imagen.server'
import { generateThumbnailInBackground } from './generate-thumbnail.server'
import { withProviderRetry } from './provider-retry.server'
import { createImageStorage } from '@/lib/image-storage'

export const MAX_CONCURRENT_GOOGLE = 3

interface QueuedRecord {
  id: string
  user_id: string
  generation_metadata: Record<string, unknown>
}

async function executeGoogleRecord(
  supabase: any,
  record: QueuedRecord,
): Promise<void> {
  const meta = record.generation_metadata
  const prompt = (meta.prompt as string | undefined) ?? ''
  const modelId = (meta.model as string | undefined) ?? 'fal-ai/nano-banana-2'
  const aspectRatio = meta.aspect_ratio as string | undefined
  const imageBase64 = meta.image_base64 as string | undefined
  const referenceImagesBase64 = meta.reference_images_base64 as
    | Array<string>
    | undefined

  try {
    const hasImages = !!imageBase64 || !!referenceImagesBase64?.length
    const isEdit = modelId.endsWith('/edit') || hasImages

    const result = await withProviderRetry('google', () => {
      if (isEdit && hasImages) {
        const primaryImage = imageBase64 ?? referenceImagesBase64![0]
        const additionalImages = imageBase64
          ? referenceImagesBase64
          : referenceImagesBase64?.slice(1)
        return editWithGoogle({
          prompt,
          imageBase64: primaryImage,
          additionalImagesBase64: additionalImages,
          aspectRatio,
        })
      }
      return generateWithGoogle({ prompt, aspectRatio })
    })

    const imageBytes = Buffer.from(result.imageBase64, 'base64')
    const fileHash = crypto
      .createHash('sha256')
      .update(imageBytes)
      .digest('hex')
    const timestamp = Date.now()
    const uuid = crypto.randomUUID()
    const fileName = `ai_${timestamp}_${uuid}.png`
    const storagePath = `${record.user_id}/${fileName}`

    const storage = createImageStorage(supabase)
    await storage.upload(storagePath, imageBytes, { contentType: 'image/png' })

    const { error: updateError } = await supabase
      .from('user_images')
      .update({
        status: 'completed',
        storage_path: storagePath,
        thumbnail_path: null,
        file_name: fileName,
        file_hash: fileHash,
        file_size: imageBytes.length,
        mime_type: 'image/png',
        title: modelId,
        description:
          prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt,
        generation_metadata: {
          ...meta,
          completed_at: new Date().toISOString(),
          image_base64: undefined,
          reference_images_base64: undefined,
        },
      })
      .eq('id', record.id)
      .eq('user_id', record.user_id)

    if (updateError) {
      await storage.remove([storagePath])
      throw new Error(`Update failed: ${updateError.message}`)
    }

    generateThumbnailInBackground(
      supabase,
      record.user_id,
      storagePath,
      record.id,
    )
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Google generation failed'
    console.error(`[google-queue] record=${record.id} failed: ${errorMsg}`)
    await supabase
      .from('user_images')
      .update({
        status: 'failed',
        generation_error: errorMsg,
        generation_metadata: {
          ...meta,
          error: { message: errorMsg, code: 'google_error' },
          failed_at: new Date().toISOString(),
          image_base64: undefined,
          reference_images_base64: undefined,
        },
      })
      .eq('id', record.id)
      .eq('user_id', record.user_id)
  }
}

/** Dispatch queued Google records up to MAX_CONCURRENT_GOOGLE and run them. */
export async function dispatchGoogleQueue(supabase: any): Promise<number> {
  const { data: claimed, error } = await supabase.rpc('dispatch_google_queue', {
    p_max_concurrent: MAX_CONCURRENT_GOOGLE,
  })

  if (error) {
    console.error('[google-queue] dispatch RPC error:', error.message)
    return 0
  }

  const records: Array<QueuedRecord> = claimed ?? []
  if (records.length === 0) return 0

  console.log(`[google-queue] dispatching ${records.length} record(s)`)

  await Promise.allSettled(
    records.map((record) => executeGoogleRecord(supabase, record)),
  )

  return records.length
}
