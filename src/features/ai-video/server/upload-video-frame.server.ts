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

    // If original provided, upload it and use it for the user_images record
    let recordStoragePath = croppedStoragePath
    let recordFileName = croppedFileName
    let recordBuffer = croppedBuffer

    if (originalBase64) {
      const originalBase64Data = originalBase64.replace(
        /^data:image\/\w+;base64,/,
        '',
      )
      const originalBuffer = Buffer.from(originalBase64Data, 'base64')
      const originalFileName = `upload_${timestamp}_${uuid}.jpg`
      const originalStoragePath = `${user.id}/${originalFileName}`

      await storage.upload(originalStoragePath, originalBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      })

      recordStoragePath = originalStoragePath
      recordFileName = originalFileName
      recordBuffer = originalBuffer
    }

    const fileHash = crypto
      .createHash('sha256')
      .update(recordBuffer)
      .digest('hex')

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        status: 'completed',
        source: 'ai_video_frame',
        title: `Uploaded ${frameType} frame`,
        storage_path: recordStoragePath,
        file_name: recordFileName,
        file_hash: fileHash,
        file_size: recordBuffer.length,
        mime_type: 'image/jpeg',
        generation_metadata: {
          frame_type: frameType,
          uploaded: true,
          uploaded_at: new Date().toISOString(),
          ...(originalBase64
            ? { cropped_storage_path: croppedStoragePath }
            : {}),
        },
      })
      .select()
      .single()

    if (insertError) {
      // Clean up uploaded files
      const pathsToRemove = [croppedStoragePath]
      if (originalBase64) pathsToRemove.push(recordStoragePath)
      await storage.remove(pathsToRemove)
      throw new Error(`Failed to create frame record: ${insertError.message}`)
    }

    // Return signed URL for the original version (display uses object-contain)
    const displayPath = originalBase64 ? recordStoragePath : croppedStoragePath
    const signedUrl = await storage.getUrl(displayPath, {
      ttl: 3600,
      cached: false,
    })

    if (!signedUrl) {
      throw new Error('Failed to create signed URL')
    }

    return { recordId: record.id, signedUrl }
  })
