import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateFirstFrameInput {
  prompt: string
  model: string
  accessToken: string
}

export const generateFirstFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateFirstFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, model } = data

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'first_frame',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const webhookUrl = getFalWebhookUrl()
    const { request_id } = await fal.queue.submit(model, {
      input: { prompt, safety_tolerance: 6 },
      ...(webhookUrl ? { webhookUrl } : {}),
    })

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_video_frame',
        title: 'Generating first frame...',
        generation_metadata: {
          prompt,
          model,
          frame_type: 'first',
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
