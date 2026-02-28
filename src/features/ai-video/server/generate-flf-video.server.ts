import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const VIDEO_MODEL = 'fal-ai/kling-video/o1/image-to-video'

interface GenerateFlfVideoInput {
  firstFrameRecordId: string
  lastFrameRecordId: string
  prompt: string
  accessToken: string
  duration?: '5' | '10'
  cfgScale?: number
  negativePrompt?: string
}

async function uploadFrameToFal(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const { data: signedUrlData } = await supabase.storage
    .from('user-images')
    .createSignedUrl(storagePath, 3600)

  if (!signedUrlData?.signedUrl) {
    throw new Error('Failed to create signed URL for frame')
  }

  const res = await fetch(signedUrlData.signedUrl)
  if (!res.ok) throw new Error('Failed to fetch frame image')

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

export const generateFlfVideo = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateFlfVideoInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { firstFrameRecordId, lastFrameRecordId, prompt } = data

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'video_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
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

    // Fetch both frame records
    const { data: frames } = await supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', [firstFrameRecordId, lastFrameRecordId])
      .eq('user_id', user.id)
      .eq('status', 'completed')

    const firstFrame = frames?.find((f) => f.id === firstFrameRecordId)
    const lastFrame = frames?.find((f) => f.id === lastFrameRecordId)

    if (!firstFrame?.storage_path) {
      throw new Error('First frame not found or not completed')
    }
    if (!lastFrame?.storage_path) {
      throw new Error('Last frame not found or not completed')
    }

    // Upload both frames to FAL storage for public URLs
    const [startImageUrl, endImageUrl] = await Promise.all([
      uploadFrameToFal(supabase, firstFrame.storage_path),
      uploadFrameToFal(supabase, lastFrame.storage_path),
    ])

    // Kling O1 FLF: reference frames via @Image1 / @Image2 in the prompt
    const klingPrompt = prompt
      ? `@Image1 ${prompt} @Image2`
      : '@Image1 smoothly transitions to @Image2 with fluid natural motion'

    const falInput: Record<string, unknown> = {
      start_image_url: startImageUrl,
      end_image_url: endImageUrl,
      prompt: klingPrompt,
      duration: data.duration || '5',
    }
    if (data.cfgScale !== undefined) {
      falInput.cfg_scale = data.cfgScale
    }
    if (data.negativePrompt) {
      falInput.negative_prompt = data.negativePrompt
    }

    const { request_id } = await fal.queue.submit(VIDEO_MODEL, {
      input: falInput as Record<string, unknown> & {
        prompt: string
        start_image_url: string
      },
    })

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_video',
        title: 'Generating video...',
        generation_metadata: {
          model: VIDEO_MODEL,
          prompt,
          transition_prompt: prompt || null,
          first_frame_id: firstFrameRecordId,
          last_frame_id: lastFrameRecordId,
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create video record: ${insertError.message}`)
    }

    return { recordId: record.id, request_id }
  })
