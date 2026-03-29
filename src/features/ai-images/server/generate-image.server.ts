import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import {
  checkAndDeductCredits,
  withCreditRefund,
} from '@/features/credits/server/check-credits.server'
import { describeImage } from '@/lib/server/describe-image.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { isGoogleProvider, submitGeneration } from '@/lib/server/media.server'
import { checkRateLimit } from '@/lib/server/rate-limit.server'
import { createImageStorage } from '@/lib/image-storage'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateImageInput {
  prompt: string
  model: string
  accessToken: string
  aspectRatio?: string
  sourceImageBase64?: string
  sourceImageUrl?: string
  isRefine?: boolean
  referenceImageIds?: Array<string>
  providerOverride?: 'fal' | 'google'
  parentImageId?: string
  idempotencyKey?: string
}

function buildRefinePrompt(userPrompt: string): string {
  return `Re-imagine this: ${userPrompt}`
}

export const generateImage = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    await checkRateLimit(user.id, 'image')

    const {
      prompt,
      model,
      aspectRatio,
      sourceImageBase64,
      sourceImageUrl,
      isRefine,
      providerOverride,
    } = data

    // Resolve provider: override wins, else check model registry
    const useGoogle = providerOverride
      ? providerOverride === 'google'
      : isGoogleProvider(model)

    if (!sourceImageBase64 && !sourceImageUrl && !prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!useGoogle && !process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Idempotency: if key provided and a non-failed record exists, return it
    if (data.idempotencyKey) {
      const { data: existing } = await createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
        },
      )
        .from('user_images')
        .select('id, request_id, status')
        .eq('idempotency_key', data.idempotencyKey)
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

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'image_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    return withCreditRefund(
      creditResult.userId,
      creditResult.cost,
      'image_gen',
      async () => {
        // Create Supabase client authenticated as the user
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.VITE_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${data.accessToken}` },
            },
          },
        )

        const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === model)

        let falModelId = model
        let effectivePrompt = prompt.trim()
        let imageUrl: string | null = null
        let sourceBase64Data: string | null = null

        if (sourceImageUrl) {
          imageUrl = sourceImageUrl
          falModelId = modelDef?.imageInputModelId ?? model
        } else if (sourceImageBase64) {
          // Strip data URL prefix and decode to buffer
          const base64Data = sourceImageBase64.replace(
            /^data:image\/\w+;base64,/,
            '',
          )
          const buffer = Buffer.from(base64Data, 'base64')

          // Detect mime type from magic bytes
          let mimeType:
            | 'image/jpeg'
            | 'image/png'
            | 'image/gif'
            | 'image/webp' = 'image/jpeg'
          const bytes = new Uint8Array(buffer.slice(0, 4))
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

          // Store raw base64 for Google path
          sourceBase64Data = base64Data

          // Upload to FAL storage (only needed for FAL path)
          if (!useGoogle) {
            imageUrl = await fal.storage.upload(
              new Blob([buffer], { type: mimeType }),
            )
          }

          // Use image-mode endpoint if specified
          falModelId = modelDef?.imageInputModelId ?? model
        }

        // Save the user-facing prompt before any model-specific wrapping
        const metadataPrompt = effectivePrompt

        // Apply refine wrapping for FAL only
        if (sourceImageUrl && isRefine) {
          effectivePrompt = buildRefinePrompt(effectivePrompt)
        }

        // Fetch reference images -- as base64 for Google, as FAL URLs for FAL
        let referenceUrls: Array<string> = []
        let referenceImagesBase64: Array<string> = []
        if (data.referenceImageIds?.length) {
          const refImages = await supabase
            .from('user_images')
            .select('id, storage_path')
            .in('id', data.referenceImageIds)
            .eq('user_id', user.id)

          if (refImages.data?.length) {
            const storage = createImageStorage(supabase)
            if (useGoogle) {
              // Google path: fetch as base64
              const base64Results = await Promise.all(
                refImages.data.map(async (ref) => {
                  if (!ref.storage_path) return null
                  const signedUrl = await storage.getUrl(ref.storage_path)
                  if (!signedUrl) return null
                  const res = await fetch(signedUrl)
                  const buf = await res.arrayBuffer()
                  return Buffer.from(buf).toString('base64')
                }),
              )
              referenceImagesBase64 = base64Results.filter(
                (b): b is string => b !== null,
              )
            } else {
              // FAL path: upload to FAL storage
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
          }

          // Reference images require image-input model variant
          if (
            (referenceUrls.length > 0 || referenceImagesBase64.length > 0) &&
            !imageUrl
          ) {
            falModelId = modelDef?.imageInputModelId ?? model
          }
        }

        // --- Google provider: route through submitGeneration ---
        if (useGoogle) {
          const result = await submitGeneration({
            accessToken: data.accessToken,
            userId: user.id,
            prompt: effectivePrompt,
            modelId: falModelId,
            aspectRatio,
            imageBase64: sourceBase64Data ?? undefined,
            referenceImagesBase64:
              referenceImagesBase64.length > 0
                ? referenceImagesBase64
                : undefined,
            providerOverride,
            metadata: {
              ...(sourceImageBase64 ? { has_source_image: true } : {}),
              ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
              ...(data.referenceImageIds?.length
                ? { reference_image_ids: data.referenceImageIds }
                : {}),
              ...(data.parentImageId
                ? {
                    source_image_id: data.parentImageId,
                    generation_type: 'variation',
                  }
                : {}),
            },
          })

          return {
            recordId: result.recordId,
            request_id: result.request_id,
            prompt,
            model,
          }
        }

        // --- FAL provider: existing queue-based path ---
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

        // Create database record with pending status
        const { data: record, error: insertError } = await supabase
          .from('user_images')
          .insert({
            user_id: user.id,
            request_id: request_id,
            status: 'pending',
            source: 'ai_generated',
            title: 'Generating...',
            sort_order: Date.now() / 1000,
            ...(data.idempotencyKey
              ? { idempotency_key: data.idempotencyKey }
              : {}),
            generation_metadata: {
              prompt: metadataPrompt,
              model,
              fal_model_id: falModelId,
              submitted_at: new Date().toISOString(),
              ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
              ...(sourceImageBase64 ? { has_source_image: true } : {}),
              ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
              ...(data.referenceImageIds?.length
                ? { reference_image_ids: data.referenceImageIds }
                : {}),
              ...(data.parentImageId
                ? {
                    source_image_id: data.parentImageId,
                    generation_type: 'variation',
                  }
                : {}),
            },
          })
          .select()
          .single()

        if (insertError) {
          throw new Error(
            `Failed to create image record: ${insertError.message}`,
          )
        }

        return {
          recordId: record.id,
          request_id,
          prompt,
          model,
        }
      },
    )
  })
