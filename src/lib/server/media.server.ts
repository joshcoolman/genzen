/**
 * Provider-aware submission router.
 * Google models return completed records synchronously.
 * FAL models return pending records for async polling.
 */
import crypto from 'node:crypto'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { editWithGoogle, generateWithGoogle } from './google-imagen.server'
import { generateAndStoreThumbnail } from './generate-thumbnail.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'

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
  accessToken: string
  userId: string
  prompt: string
  modelId: string
  aspectRatio?: string
  imageBase64?: string
  referenceImagesBase64?: Array<string>
  metadata?: Record<string, unknown>
  title?: string
  providerOverride?: 'fal' | 'google'
}

export interface SubmitGenerationResult {
  recordId: string
  request_id?: string
  status: 'pending' | 'completed'
}

function createUserSupabase(accessToken: string) {
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
  const prompt = options.prompt
  const modelName =
    ALL_IMAGE_MODELS.find((m) => m.id === baseModelId)?.name ?? baseModelId

  // Phase 1: Create pending record immediately so the UI shows a pending card
  // and navigation won't lose the generation (server continues to completion)
  const { data: record, error: insertError } = await supabase
    .from('user_images')
    .insert({
      user_id: options.userId,
      status: 'pending',
      source: 'ai_generated',
      title: options.title ?? 'Generating...',
      sort_order: Date.now() / 1000,
      generation_metadata: {
        prompt,
        model: baseModelId,
        provider: 'google',
        generation_type: options.metadata?.generation_type ?? 'text_to_image',
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

  const recordId: string = record.id

  // Phase 2: Call Google API (2-5s) and update the record on completion
  try {
    const hasImages =
      !!options.imageBase64 || !!options.referenceImagesBase64?.length
    const isEdit = options.modelId.endsWith('/edit') || hasImages

    let result: { imageBase64: string; mimeType: string }

    if (isEdit && hasImages) {
      // Determine primary image and additional images
      const primaryImage =
        options.imageBase64 ?? options.referenceImagesBase64?.[0]
      const additionalImages = options.imageBase64
        ? options.referenceImagesBase64
        : options.referenceImagesBase64?.slice(1)

      result = await editWithGoogle({
        prompt: options.prompt,
        imageBase64: primaryImage!,
        additionalImagesBase64: additionalImages,
        aspectRatio: options.aspectRatio,
      })
    } else {
      result = await generateWithGoogle({
        prompt: options.prompt,
        aspectRatio: options.aspectRatio,
      })
    }

    // Store image in Supabase storage
    const imageBytes = Buffer.from(result.imageBase64, 'base64')
    const fileHash = crypto
      .createHash('sha256')
      .update(imageBytes)
      .digest('hex')
    const timestamp = Date.now()
    const uuid = crypto.randomUUID()
    const fileName = `ai_${timestamp}_${uuid}.png`
    const storagePath = `${options.userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(storagePath, imageBytes, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const thumbnailPath = await generateAndStoreThumbnail(
      supabase,
      options.userId,
      storagePath,
    )

    // Update record to completed
    const { error: updateError } = await supabase
      .from('user_images')
      .update({
        status: 'completed',
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        file_name: fileName,
        file_hash: fileHash,
        file_size: imageBytes.length,
        mime_type: 'image/png',
        title: modelName,
        description:
          prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt,
        generation_metadata: {
          prompt,
          model: baseModelId,
          provider: 'google',
          generation_type: options.metadata?.generation_type ?? 'text_to_image',
          submitted_at: record.generation_metadata?.submitted_at,
          completed_at: new Date().toISOString(),
          ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
          ...options.metadata,
        },
      })
      .eq('id', recordId)

    if (updateError) {
      await supabase.storage.from('user-images').remove([storagePath])
      throw new Error(`Update failed: ${updateError.message}`)
    }
  } catch (error) {
    // Mark the record as failed so the UI shows a failure card
    await supabase
      .from('user_images')
      .update({
        status: 'failed',
        generation_metadata: {
          ...record.generation_metadata,
          error:
            error instanceof Error ? error.message : 'Google generation failed',
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', recordId)

    throw error
  }

  return { recordId, status: 'completed' }
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

  const { request_id } = await (fal.queue.submit as any)(options.modelId, {
    input: falInput,
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
