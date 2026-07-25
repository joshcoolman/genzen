import { fal } from '@fal-ai/client'
import { buildFalInput } from './fal-params.server'
import { resolveAuth } from '@/lib/server/auth.server'
import { describeImage } from '@/lib/server/describe-image.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { checkRateLimit } from '@/lib/server/rate-limit.server'
import { createImageStorage } from '@/lib/image-storage'
import { computeFalCostCents } from '@/lib/server/compute-cost.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export interface GenerateImageInput {
  prompt: string
  model: string
  accessToken?: string
  userId?: string
  aspectRatio?: string
  sourceImageBase64?: string
  sourceImageUrl?: string
  isRefine?: boolean
  referenceImageIds?: Array<string>
  parentImageId?: string
  idempotencyKey?: string
  sourceClient?: string
  /** Mark the created row as living on the canvas, so it's reclaimable on load */
  onCanvas?: boolean
}

function buildRefinePrompt(userPrompt: string): string {
  return `Re-imagine this: ${userPrompt}`
}

export interface GenerateImageResult {
  recordId: string
  request_id: string
  prompt: string
  model: string
}

/**
 * Plain async implementation. Use this from server-to-server callers
 * (MCP tools, other server fns) — calling the createServerFn wrapper
 * goes through TanStack's RPC stub and corrupts the response shape.
 */
export async function generateImageInternal(
  data: GenerateImageInput,
): Promise<GenerateImageResult> {
  const { userId, supabase } = await resolveAuth({
    accessToken: data.accessToken,
    userId: data.userId,
  })
  await checkRateLimit(userId, 'image')

  const {
    prompt,
    model,
    aspectRatio,
    sourceImageBase64,
    sourceImageUrl,
    isRefine,
  } = data

  if (!sourceImageBase64 && !sourceImageUrl && !prompt.trim()) {
    throw new Error('Prompt is required')
  }

  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY environment variable is not set')
  }

  // Idempotency: if key provided and a non-failed record exists, return it
  if (data.idempotencyKey) {
    const { data: existing } = await supabase
      .from('user_images')
      .select('id, request_id, status')
      .eq('idempotency_key', data.idempotencyKey)
      .eq('user_id', userId)
      .single()
    if (existing && existing.status !== 'failed') {
      return {
        recordId: existing.id,
        request_id: existing.request_id ?? '',
        prompt,
        model,
      }
    }
  }

  const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === model)

  let falModelId = model
  let effectivePrompt = prompt.trim()
  let imageUrl: string | null = null

  if (sourceImageUrl) {
    imageUrl = sourceImageUrl
    falModelId = modelDef?.imageInputModelId ?? model
  } else if (sourceImageBase64) {
    // Strip data URL prefix and decode to buffer
    const base64Data = sourceImageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Detect mime type from magic bytes
    let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
      'image/jpeg'
    const bytes = new Uint8Array(buffer.subarray(0, 4))
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      mimeType = 'image/png'
    } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
      mimeType = 'image/gif'
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
      mimeType = 'image/webp'
    }

    // If no user prompt, ask Haiku for a plain factual description of the image
    if (!effectivePrompt) {
      try {
        effectivePrompt = await describeImage(base64Data, 'anchor')
      } catch {
        effectivePrompt = 'image'
      }
    }

    imageUrl = await fal.storage.upload(new Blob([buffer], { type: mimeType }))

    // Use image-mode endpoint if specified
    falModelId = modelDef?.imageInputModelId ?? model
  }

  // Save the user-facing prompt before any model-specific wrapping
  const metadataPrompt = effectivePrompt

  // Apply refine wrapping for FAL only
  if (sourceImageUrl && isRefine) {
    effectivePrompt = buildRefinePrompt(effectivePrompt)
  }

  // Fetch reference images and upload them to FAL storage
  let referenceUrls: Array<string> = []
  if (data.referenceImageIds?.length) {
    const refImages = await supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', data.referenceImageIds)
      .eq('user_id', userId)

    if (refImages.data?.length) {
      const storage = createImageStorage()
      const uploads = await Promise.all(
        refImages.data.map(async (ref) => {
          if (!ref.storage_path) return null
          const signedUrl = await storage.getUrl(ref.storage_path)
          if (!signedUrl) return null
          const res = await fetch(signedUrl)
          const buf = await res.arrayBuffer()
          return uploadBufferToFal(buf)
        }),
      )
      referenceUrls = uploads.filter((u): u is string => u !== null)
    }

    // Reference images require image-input model variant
    if (referenceUrls.length > 0 && !imageUrl) {
      falModelId = modelDef?.imageInputModelId ?? model
    }
  }

  // Combine source image + ref images + style refs into imageUrls
  const allImageUrls = [...(imageUrl ? [imageUrl] : []), ...referenceUrls]

  // Build FAL input using schema-driven param resolution
  const falInput = await buildFalInput({
    modelId: falModelId,
    prompt: effectivePrompt,
    aspectRatio,
    ...(allImageUrls.length > 0 ? { imageUrls: allImageUrls } : {}),
    safetyLevel: 'permissive',
  })

  // Submit to FAL async queue (returns immediately)
  const webhookUrl = getFalWebhookUrl()

  const { request_id } = await (fal.queue.submit as any)(falModelId, {
    input: falInput,
    ...(webhookUrl ? { webhookUrl } : {}),
  })

  const estimatedCostCents = await computeFalCostCents(falModelId, {
    aspectRatio,
  }).catch(() => null)

  // Create database record with pending status
  const { data: record, error: insertError } = await supabase
    .from('user_images')
    .insert({
      user_id: userId,
      request_id: request_id,
      status: 'pending',
      source: 'ai_generated',
      title: 'Generating...',
      sort_order: Date.now() / 1000,
      ...(data.onCanvas ? { on_canvas: true } : {}),
      ...(data.idempotencyKey ? { idempotency_key: data.idempotencyKey } : {}),
      generation_metadata: {
        prompt: metadataPrompt,
        model,
        fal_model_id: falModelId,
        submitted_at: new Date().toISOString(),
        ...(estimatedCostCents != null
          ? { estimated_cost_cents: estimatedCostCents }
          : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(sourceImageBase64 ? { has_source_image: true } : {}),
        ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
        ...(data.referenceImageIds?.length
          ? { reference_image_ids: data.referenceImageIds }
          : {}),
        ...(data.parentImageId
          ? {
              source_image_id: data.parentImageId, // Immutable: actual generation source
              parent_id: data.parentImageId, // Mutable: group parent (same initially)
              generation_type: 'variation',
            }
          : {}),
        ...(data.sourceClient ? { source_client: data.sourceClient } : {}),
      },
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create image record: ${insertError.message}`)
  }

  return {
    recordId: record.id,
    request_id,
    prompt,
    model,
  }
}
