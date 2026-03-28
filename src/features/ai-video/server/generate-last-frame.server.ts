import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { createImageStorage } from '@/lib/image-storage'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const KONTEXT_MODEL = 'fal-ai/flux-pro/kontext/max'
const NANO_BANANA_MODEL = 'fal-ai/nano-banana-pro/edit'

interface GenerateLastFrameInput {
  prompt: string
  firstFrameRecordId: string
  model?: 'kontext' | 'nano-banana'
  accessToken: string
  includeFirstFrame?: boolean
}

export const generateLastFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateLastFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, firstFrameRecordId } = data
    const shouldIncludeFirstFrame = data.includeFirstFrame !== false

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'last_frame',
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

    let falImageUrl: string | null = null

    if (shouldIncludeFirstFrame) {
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
      const signedUrl = await createImageStorage(supabase).getUrl(
        firstFrame.storage_path,
        { ttl: 3600, cached: false },
      )

      if (!signedUrl) {
        throw new Error('Failed to create signed URL for first frame')
      }

      const imageRes = await fetch(signedUrl)
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
      falImageUrl = await fal.storage.upload(
        new Blob([buffer], { type: mediaType }),
      )
    }

    const useNanoBanana = data.model === 'nano-banana'
    const modelId = useNanoBanana ? NANO_BANANA_MODEL : KONTEXT_MODEL

    // Build FAL input — omit image reference when not including first frame
    let input: Record<string, unknown>
    if (useNanoBanana) {
      input = {
        prompt,
        aspect_ratio: '16:9',
        safety_tolerance: '6',
        ...(falImageUrl ? { image_urls: [falImageUrl] } : {}),
      }
    } else {
      input = {
        prompt,
        safety_tolerance: '6',
        aspect_ratio: '16:9',
        guidance_scale: 2.0,
        ...(falImageUrl ? { image_url: falImageUrl } : {}),
      }
    }

    const webhookUrl = getFalWebhookUrl()
    const { request_id } = await fal.queue.submit(modelId, {
      input: input as never,
      ...(webhookUrl ? { webhookUrl } : {}),
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
          model: modelId,
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
