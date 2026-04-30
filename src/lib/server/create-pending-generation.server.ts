import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase-admin.server'

interface CreatePendingGenerationOptions {
  accessToken?: string
  userId: string
  requestId: string
  generationType: string
  falModelId: string
  prompt: string
  aspectRatio?: string
  extraMetadata?: Record<string, unknown>
  title?: string
  idempotencyKey?: string
}

export async function createPendingGeneration({
  accessToken,
  userId,
  requestId,
  generationType,
  falModelId,
  prompt,
  aspectRatio,
  extraMetadata,
  title = 'Generating...',
  idempotencyKey,
}: CreatePendingGenerationOptions): Promise<{ recordId: string }> {
  const supabase = accessToken
    ? createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        },
      )
    : getSupabaseAdmin()

  const model = falModelId.replace(/\/edit$/, '')

  const { data: record, error: insertError } = await supabase
    .from('user_images')
    .insert({
      user_id: userId,
      request_id: requestId,
      status: 'pending',
      source: 'ai_generated',
      title,
      sort_order: Date.now() / 1000,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      generation_metadata: {
        prompt,
        model,
        fal_model_id: falModelId,
        generation_type: generationType,
        submitted_at: new Date().toISOString(),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...extraMetadata,
      },
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create image record: ${insertError.message}`)
  }

  return { recordId: record.id }
}
