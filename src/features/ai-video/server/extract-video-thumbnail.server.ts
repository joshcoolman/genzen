import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const FFMPEG_EXTRACT_MODEL = 'fal-ai/ffmpeg-api/extract-frame'

interface ExtractVideoThumbnailInput {
  accessToken: string
  videoId: string
}

/**
 * Extract a middle-frame thumbnail from a completed video via FAL's ffmpeg
 * endpoint, upload the result to R2, and store the path in `thumbnail_path`.
 *
 * Safe to call multiple times -- early exits if the video is not completed
 * or already has a thumbnail. Silent no-op on any failure (thumbnail stays
 * null and the gallery falls back to the source start/first frame).
 */
export const extractVideoThumbnail = createServerFn({ method: 'POST' })
  .inputValidator((data: ExtractVideoThumbnailInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) return { ok: false, reason: 'no-fal-key' }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Load the video row
    const { data: row, error: fetchError } = await supabase
      .from('user_images')
      .select('id, status, thumbnail_path, generation_metadata, user_id')
      .eq('id', data.videoId)
      .eq('user_id', user.id)
      .eq('source', 'ai_video')
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !row) return { ok: false, reason: 'not-found' }
    if (row.status !== 'completed')
      return { ok: false, reason: 'not-completed' }
    if (row.thumbnail_path) return { ok: true, reason: 'already-extracted' }

    const meta = (row.generation_metadata ?? {}) as Record<string, unknown>
    const videoUrl =
      (meta.fal_url as string | undefined) ??
      (meta.thumbnail_url as string | undefined)
    if (!videoUrl) return { ok: false, reason: 'no-video-url' }

    // Call FAL ffmpeg to extract the middle frame
    let extractedUrl: string | null = null
    try {
      const result = await fal.subscribe(FFMPEG_EXTRACT_MODEL, {
        input: { video_url: videoUrl, frame_type: 'middle' },
      })
      const images = (result.data as { images?: Array<{ url?: string }> })
        .images
      extractedUrl = images?.[0]?.url ?? null
    } catch (err) {
      console.error('[extract-video-thumbnail] fal call failed', err)
      return { ok: false, reason: 'fal-failed' }
    }

    if (!extractedUrl) return { ok: false, reason: 'no-frame-returned' }

    // Download the extracted frame and upload to R2 under user-scoped path
    let buffer: ArrayBuffer
    try {
      const res = await fetch(extractedUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      buffer = await res.arrayBuffer()
    } catch (err) {
      console.error('[extract-video-thumbnail] fetch failed', err)
      return { ok: false, reason: 'fetch-failed' }
    }

    const storagePath = `${user.id}/video-thumbnails/${row.id}.jpg`
    try {
      const storage = createImageStorage(supabase)
      await storage.upload(storagePath, new Uint8Array(buffer), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    } catch (err) {
      console.error('[extract-video-thumbnail] upload failed', err)
      return { ok: false, reason: 'upload-failed' }
    }

    // Persist the thumbnail path + a cache-bust timestamp in metadata so
    // the client URL changes whenever the thumbnail is (re)generated.
    const existingMeta = (row.generation_metadata ?? {}) as Record<
      string,
      unknown
    >
    const nextMeta = { ...existingMeta, thumbnail_updated_at: Date.now() }

    const { error: updateError } = await supabase
      .from('user_images')
      .update({
        thumbnail_path: storagePath,
        generation_metadata: nextMeta,
      })
      .eq('id', row.id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[extract-video-thumbnail] update failed', updateError)
      return { ok: false, reason: 'update-failed' }
    }

    return { ok: true, thumbnailPath: storagePath }
  })
