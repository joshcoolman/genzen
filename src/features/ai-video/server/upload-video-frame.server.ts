import crypto from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface UploadVideoFrameInput {
  imageBase64: string
  frameType: 'first' | 'last'
  accessToken: string
}

export const uploadVideoFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: UploadVideoFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const { imageBase64, frameType } = data

    // Strip data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const fileHash = crypto
      .createHash('sha256')
      .update(imageBuffer)
      .digest('hex')

    const timestamp = Date.now()
    const uuid = crypto.randomUUID()
    const fileName = `frame_${timestamp}_${uuid}.jpg`
    const storagePath = `${user.id}/${fileName}`

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        status: 'completed',
        source: 'ai_video_frame',
        title: `Uploaded ${frameType} frame`,
        storage_path: storagePath,
        file_name: fileName,
        file_hash: fileHash,
        file_size: imageBuffer.length,
        mime_type: 'image/jpeg',
        generation_metadata: {
          frame_type: frameType,
          uploaded: true,
          uploaded_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      await supabase.storage.from('user-images').remove([storagePath])
      throw new Error(`Failed to create frame record: ${insertError.message}`)
    }

    const { data: urlData } = await supabase.storage
      .from('user-images')
      .createSignedUrl(storagePath, 3600)

    if (!urlData) {
      throw new Error('Failed to create signed URL')
    }

    return { recordId: record.id, signedUrl: urlData.signedUrl }
  })
