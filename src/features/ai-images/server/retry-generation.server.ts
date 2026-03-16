import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface RetryGenerationInput {
  accessToken: string
  recordId: string
}

export const retryGeneration = createServerFn({ method: 'POST' })
  .inputValidator((data: RetryGenerationInput) => data)
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

    // Fetch the failed record
    const { data: record, error: fetchError } = await supabase
      .from('user_images')
      .select('id, status, generation_metadata')
      .eq('id', data.recordId)
      .eq('user_id', user.id)
      .eq('status', 'failed')
      .single()

    if (fetchError) {
      throw new Error('Record not found or not in failed state')
    }

    const meta = record.generation_metadata as {
      prompt?: string
      model?: string
      fal_model_id?: string
      aspect_ratio?: string
      source_image_url?: string
    }

    if (!meta.prompt || !meta.model) {
      throw new Error('Missing generation metadata — cannot retry')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'image_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const falModelId = meta.fal_model_id ?? meta.model

    const falInput = await buildFalInput({
      modelId: falModelId,
      prompt: meta.prompt,
      aspectRatio: meta.aspect_ratio,
      ...(meta.source_image_url ? { imageUrl: meta.source_image_url } : {}),
      safetyLevel: 'permissive',
    })

    const { request_id } = await (fal.queue.submit as any)(falModelId, {
      input: falInput,
    })

    const { data: newRecord, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Generating...',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          ...meta,
          retried_from: data.recordId,
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create retry record: ${insertError.message}`)
    }

    return { recordId: newRecord.id }
  })
