import crypto from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { createImageStorage } from '@/lib/image-storage'
import { requireAuth } from '@/lib/server/auth.server'

interface UploadVideoFrameInput {
  imageBase64: string
  originalBase64?: string
  frameType: 'first' | 'last'
  accessToken: string
}

export const uploadVideoFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: UploadVideoFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const { imageBase64, originalBase64, frameType } = data

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const timestamp = Date.now()
    const uuid = crypto.randomUUID()

    // Upload cropped frame
    const croppedBase64Data = imageBase64.replace(
      /^data:image\/\w+;base64,/,
      '',
    )
    const croppedBuffer = Buffer.from(croppedBase64Data, 'base64')
    const croppedFileName = `frame_${timestamp}_${uuid}.jpg`
    const croppedStoragePath = `${user.id}/${croppedFileName}`

    const storage = createImageStorage(supabase)

    await storage.upload(croppedStoragePath, croppedBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })

    // If original provided, upload it to R2 but keep cropped as the canonical record
    let originalStoragePath: string | null = null

    if (originalBase64) {
      const originalBase64Data = originalBase64.replace(
        /^data:image\/\w+;base64,/,
        '',
      )
      const originalBuffer = Buffer.from(originalBase64Data, 'base64')
      const originalFileName = `upload_${timestamp}_${uuid}.jpg`
      originalStoragePath = `${user.id}/${originalFileName}`

      await storage.upload(originalStoragePath, originalBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      })
    }

    // Always use the 1280x720 cropped version as the canonical record —
    // it is guaranteed ≥ 300x300 and is the correct aspect ratio for FAL video gen.
    const fileHash = crypto
      .createHash('sha256')
      .update(croppedBuffer)
      .digest('hex')

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        status: 'completed',
        source: 'ai_video_frame',
        title: `Uploaded ${frameType} frame`,
        storage_path: croppedStoragePath,
        file_name: croppedFileName,
        file_hash: fileHash,
        file_size: croppedBuffer.length,
        mime_type: 'image/jpeg',
        generation_metadata: {
          frame_type: frameType,
          uploaded: true,
          uploaded_at: new Date().toISOString(),
          ...(originalStoragePath
            ? {
                original_storage_path: originalStoragePath,
                cropped_storage_path: croppedStoragePath,
              }
            : {}),
        },
      })
      .select()
      .single()

    if (insertError) {
      // Clean up uploaded files
      const pathsToRemove = [croppedStoragePath]
      if (originalStoragePath) pathsToRemove.push(originalStoragePath)
      await storage.remove(pathsToRemove)
      throw new Error(`Failed to create frame record: ${insertError.message}`)
    }

    // Return signed URL for display — use cropped (canonical) path
    const signedUrl = await storage.getUrl(croppedStoragePath)

    if (!signedUrl) {
      throw new Error('Failed to create signed URL')
    }

    return { recordId: record.id, signedUrl }
  })
