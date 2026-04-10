import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

interface UploadVideoThumbnailInput {
  accessToken: string
  videoId: string
  /** JPEG or PNG data URL from a canvas.toDataURL() call */
  imageBase64: string
}

/**
 * Accept a client-captured frame (from scrubbing the video in a picker
 * dialog), upload it to R2 under the video's thumbnail path, and persist
 * the path on the user_images row. Clears the `thumbnail_cleared` flag
 * so the card immediately shows the new thumb.
 */
export const uploadVideoThumbnail = createServerFn({ method: 'POST' })
  .inputValidator((data: UploadVideoThumbnailInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Verify the video belongs to this user
    const { data: row, error: fetchError } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('id', data.videoId)
      .eq('user_id', user.id)
      .eq('source', 'ai_video')
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !row) {
      throw new Error('Video not found')
    }

    // Decode base64 data URL → raw bytes
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
      data.imageBase64,
    )
    if (!match) {
      throw new Error('Invalid image data URL')
    }
    const contentType = match[1]
    const base64 = match[2]
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : 'jpg'

    const storagePath = `${user.id}/video-thumbnails/${row.id}.${ext}`

    try {
      const storage = createImageStorage(supabase)
      await storage.upload(storagePath, bytes, {
        contentType,
        upsert: true,
      })
    } catch (err) {
      console.error('[upload-video-thumbnail] upload failed', err)
      throw new Error('Failed to upload thumbnail')
    }

    // Clear the "cleared" flag AND stamp an update timestamp so the client
    // has a cache-buster to append to the URL. Without this, the browser
    // sees the same thumbnail_path string and serves the old bytes from
    // cache -- the upload succeeds but the user thinks nothing happened.
    const existing = (row.generation_metadata ?? {}) as Record<string, unknown>
    const nextMeta = { ...existing, thumbnail_updated_at: Date.now() }
    delete (nextMeta as { thumbnail_cleared?: boolean }).thumbnail_cleared

    const { error: updateError } = await supabase
      .from('user_images')
      .update({
        thumbnail_path: storagePath,
        generation_metadata: nextMeta,
      })
      .eq('id', row.id)
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(`Failed to update video record: ${updateError.message}`)
    }

    return { ok: true, thumbnailPath: storagePath }
  })
