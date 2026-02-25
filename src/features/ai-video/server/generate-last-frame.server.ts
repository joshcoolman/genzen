import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const LAST_FRAME_MODEL = 'fal-ai/flux-pro/kontext/max'

interface GenerateLastFrameInput {
  prompt: string
  firstFrameRecordId: string
  accessToken: string
}

export const generateLastFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateLastFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const { prompt, firstFrameRecordId } = data

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

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

    // Fetch first frame storage path
    const { data: firstFrame } = await supabase
      .from('user_images')
      .select('storage_path')
      .eq('id', firstFrameRecordId)
      .eq('user_id', user.id)
      .single()

    if (!firstFrame?.storage_path) {
      throw new Error('First frame not found or not completed')
    }

    // Create signed URL to fetch the image bytes
    const { data: signedUrlData } = await supabase.storage
      .from('user-images')
      .createSignedUrl(firstFrame.storage_path, 3600)

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to create signed URL for first frame')
    }

    const imageRes = await fetch(signedUrlData.signedUrl)
    if (!imageRes.ok) {
      throw new Error('Failed to fetch first frame image')
    }

    const buffer = await imageRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Detect format from magic bytes
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

    // Upload to FAL storage to get a public HTTPS URL (Supabase URLs are auth-gated)
    const falImageUrl = await fal.storage.upload(
      new Blob([buffer], { type: mediaType }),
    )

    const { request_id } = await fal.queue.submit(LAST_FRAME_MODEL, {
      input: {
        prompt,
        image_url: falImageUrl,
        safety_tolerance: '6',
      },
    })

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_video_frame',
        title: 'Generating last frame...',
        generation_metadata: {
          prompt,
          model: LAST_FRAME_MODEL,
          frame_type: 'last',
          first_frame_id: firstFrameRecordId,
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create frame record: ${insertError.message}`)
    }

    return { recordId: record.id, request_id }
  })
