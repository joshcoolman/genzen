/**
 * Submission router. FAL is the only image provider; submissions return
 * pending records for async polling.
 */
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase-admin.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface SubmitGenerationOptions {
  accessToken?: string
  userId: string
  prompt: string
  modelId: string
  aspectRatio?: string
  metadata?: Record<string, unknown>
  title?: string
  /** Mark the created row as living on the canvas (reclaimable on canvas load) */
  onCanvas?: boolean
}

export interface SubmitGenerationResult {
  recordId: string
  request_id?: string
  status: 'pending'
}

function createUserSupabase(accessToken?: string) {
  if (!accessToken) return getSupabaseAdmin()
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  )
}

/** Submit a generation to FAL */
export async function submitGeneration(
  options: SubmitGenerationOptions,
): Promise<SubmitGenerationResult> {
  return submitFalGeneration(createUserSupabase(options.accessToken), options)
}

async function submitFalGeneration(
  supabase: any,
  options: SubmitGenerationOptions,
): Promise<SubmitGenerationResult> {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY environment variable is not set')
  }

  const falInput = await buildFalInput({
    modelId: options.modelId,
    prompt: options.prompt,
    aspectRatio: options.aspectRatio,
  })

  const webhookUrl = getFalWebhookUrl()

  const { request_id } = await (fal.queue.submit as any)(options.modelId, {
    input: falInput,
    ...(webhookUrl ? { webhookUrl } : {}),
  })

  const baseModelId = options.modelId.replace(/\/edit$/, '')

  const { data: record, error: insertError } = await supabase
    .from('user_images')
    .insert({
      user_id: options.userId,
      request_id,
      status: 'pending',
      source: 'ai_generated',
      title: options.title ?? 'Generating...',
      sort_order: Date.now() / 1000,
      ...(options.onCanvas ? { on_canvas: true } : {}),
      generation_metadata: {
        prompt: options.prompt,
        model: baseModelId,
        fal_model_id: options.modelId,
        submitted_at: new Date().toISOString(),
        ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
        ...options.metadata,
      },
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create image record: ${insertError.message}`)
  }

  return { recordId: record.id, request_id, status: 'pending' }
}
