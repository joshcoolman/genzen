import crypto from 'node:crypto'
import { generateAndStoreThumbnail } from './generate-thumbnail.server'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function downloadAndStoreImage(
  supabase: SupabaseClient,
  userId: string,
  imageUrl: string,
): Promise<{
  storagePath: string
  thumbnailPath: string | null
  fileName: string
  fileHash: string
  fileSize: number
}> {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
  }

  const imageBuffer = await imageResponse.arrayBuffer()
  const imageBytes = new Uint8Array(imageBuffer)

  const fileHash = crypto.createHash('sha256').update(imageBytes).digest('hex')

  const timestamp = Date.now()
  const uuid = crypto.randomUUID()
  const fileName = `ai_${timestamp}_${uuid}.png`
  const storagePath = `${userId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('user-images')
    .upload(storagePath, imageBytes, {
      contentType: 'image/png',
      cacheControl: '31536000',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const thumbnailPath = await generateAndStoreThumbnail(
    supabase,
    userId,
    storagePath,
  )

  return {
    storagePath,
    thumbnailPath,
    fileName,
    fileHash,
    fileSize: imageBytes.length,
  }
}
