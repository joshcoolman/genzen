import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { MULTISHOT_FAL_MODEL } from '../types'
import type { MultiShotElement, MultiShotSettings, Shot } from '../types'
import { requireAuth } from '@/lib/server/auth.server'
import {
  checkAndDeductCredits,
  withCreditRefund,
} from '@/features/credits/server/check-credits.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateMultishotInput {
  accessToken: string
  sequenceId: string
}

export const generateMultishot = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateMultishotInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

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

    // Load sequence
    const { data: sequence, error: seqError } = await supabase
      .from('multishot_sequences')
      .select('*')
      .eq('id', data.sequenceId)
      .eq('user_id', user.id)
      .single()

    if (seqError || !sequence) throw new Error('Sequence not found')

    const shots = sequence.shots as Array<Shot>
    const elements = sequence.elements as Array<MultiShotElement>
    const settings = sequence.settings as MultiShotSettings

    // Validate
    if (shots.length === 0) throw new Error('At least one shot is required')
    const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0)
    if (totalDuration > 15) throw new Error('Total duration exceeds 15 seconds')

    // Deduct credits
    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'multishot_gen',
    )
    if (!creditResult.allowed) throw new Error('Insufficient credits')

    return withCreditRefund(
      creditResult.userId,
      creditResult.cost,
      'multishot_gen',
      async () => {
        // Upload element images to FAL storage
        const falElements = await Promise.all(
          elements.map(async (el, i) => {
            const imageUrl = await uploadImageToFal(el.frontalImageUrl)
            return {
              frontal_image_url: imageUrl,
              reference_image_urls: [imageUrl],
              label: el.label || `@Element${i + 1}`,
            }
          }),
        )

        // start_image_url is required by the API
        if (!settings.startImageUrl) {
          throw new Error('A start image is required for multi-shot generation')
        }
        const startImageUrl = await uploadImageToFal(settings.startImageUrl)

        // Build FAL input
        const falInput: Record<string, unknown> = {
          multi_prompt: shots.map((s) => ({
            prompt: s.prompt,
            duration: String(s.duration),
          })),
          shot_type: settings.shotType,
          generate_audio: settings.generateAudio,
        }

        if (falElements.length > 0) {
          falInput.elements = falElements
        }
        falInput.start_image_url = startImageUrl

        console.log(
          `[multishot-gen] submitting ${shots.length} shots, ${elements.length} elements, total=${totalDuration}s`,
        )

        const webhookUrl = getFalWebhookUrl()
        const { request_id } = await fal.queue.submit(MULTISHOT_FAL_MODEL, {
          input: falInput as Record<string, unknown> & {
            multi_prompt: unknown
          },
          ...(webhookUrl ? { webhookUrl } : {}),
        })

        // Create user_images record for polling
        const { data: record, error: insertError } = await supabase
          .from('user_images')
          .insert({
            user_id: user.id,
            request_id,
            status: 'pending',
            source: 'ai_video',
            title: `Multi-shot: ${sequence.name}`,
            generation_metadata: {
              model: MULTISHOT_FAL_MODEL,
              type: 'multishot',
              sequence_id: data.sequenceId,
              shot_count: shots.length,
              total_duration: totalDuration,
              submitted_at: new Date().toISOString(),
            },
          })
          .select()
          .single()

        if (insertError)
          throw new Error(
            `Failed to create video record: ${insertError.message}`,
          )

        // Update sequence status
        await supabase
          .from('multishot_sequences')
          .update({
            status: 'pending',
            video_record_id: record.id,
            estimated_cost: creditResult.cost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.sequenceId)

        return { recordId: record.id, requestId: request_id }
      },
    )
  })

async function uploadImageToFal(imageUrl: string): Promise<string> {
  // If already a FAL URL, skip upload
  if (imageUrl.includes('fal.media') || imageUrl.includes('fal-cdn')) {
    return imageUrl
  }

  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Failed to fetch image: ${imageUrl}`)

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}
