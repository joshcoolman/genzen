/**
 * Provider-aware submission router.
 * Google models return completed records synchronously.
 * FAL models return pending records for async polling.
 */
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase-admin.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

function isGoogleModel(modelId: string): boolean {
  const model = ALL_IMAGE_MODELS.find((m) => m.id === modelId)
  return model?.provider === 'google'
}

/** Check if a model ID (including edit variants) routes to Google */
export function isGoogleProvider(modelId: string): boolean {
  if (isGoogleModel(modelId)) return true
  const baseId = modelId.replace(/\/edit$/, '')
  return isGoogleModel(baseId)
}

interface SubmitGenerationOptions {
  accessToken?: string
  userId: string
  prompt: string
  modelId: string
  aspectRatio?: string
  imageBase64?: string
  referenceImagesBase64?: Array<string>
  metadata?: Record<string, unknown>
  title?: string
  providerOverride?: 'fal' | 'google'
  /** Mark the created row as living on the canvas (reclaimable on canvas load) */
  onCanvas?: boolean
}

export interface SubmitGenerationResult {
  recordId: string
  request_id?: string
  status: 'pending' | 'completed'
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

/** Submit a generation through the appropriate provider */
export async function submitGeneration(
  options: SubmitGenerationOptions,
): Promise<SubmitGenerationResult> {
  const supabase = createUserSupabase(options.accessToken)

  const useGoogle = options.providerOverride
    ? options.providerOverride === 'google'
    : isGoogleProvider(options.modelId)

  if (useGoogle) {
    return submitGoogleGeneration(supabase, options)
  }
  return submitFalGeneration(supabase, options)
}

async function submitGoogleGeneration(
  supabase: any,
  options: SubmitGenerationOptions,
): Promise<SubmitGenerationResult> {
  const baseModelId = options.modelId.replace(/\/edit$/, '')

  const { data: record, error: insertError } = await supabase
    .from('user_images')
    .insert({
      user_id: options.userId,
      status: 'queued',
      source: 'ai_generated',
      title: options.title ?? 'Generating...',
      sort_order: Date.now() / 1000,
      ...(options.onCanvas ? { on_canvas: true } : {}),
      generation_metadata: {
        prompt: options.prompt,
        model: baseModelId,
        provider: 'google',
        generation_type: options.metadata?.generation_type ?? 'text_to_image',
        submitted_at: new Date().toISOString(),
        ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
        // Store images in metadata so the dispatcher can access them
        ...(options.imageBase64 ? { image_base64: options.imageBase64 } : {}),
        ...(options.referenceImagesBase64?.length
          ? { reference_images_base64: options.referenceImagesBase64 }
          : {}),
        ...options.metadata,
      },
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create image record: ${insertError.message}`)
  }

  return { recordId: record.id, status: 'pending' }
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
