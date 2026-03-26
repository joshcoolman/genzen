import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import {
  checkAndDeductCredits,
  refundCredits,
} from '@/features/credits/server/check-credits.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'

interface EditImageInput {
  accessToken: string
  sourceImageId: string
  editPrompt: string
  aspectRatio?: string
  editModelId?: string
  referenceImageIds?: Array<string>
  numImages?: number
  idempotencyKey?: string
}

export const editImage = createServerFn({ method: 'POST' })
  .inputValidator((data: EditImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const {
      sourceImageId,
      editPrompt,
      aspectRatio,
      editModelId,
      referenceImageIds,
      numImages,
    } = data
    const falEditModel = editModelId || 'fal-ai/gpt-image-1.5/edit'
    const numImagesToGenerate = Math.min(Math.max(numImages ?? 1, 1), 3)
    if (!editPrompt.trim()) {
      throw new Error('Edit prompt is required')
    }

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

    // Idempotency: if key provided and a non-failed record exists, return it
    if (data.idempotencyKey) {
      const { data: existing } = await supabase
        .from('user_images')
        .select('id, request_id, status')
        .eq('idempotency_key', data.idempotencyKey)
        .single()
      if (existing && existing.status !== 'failed') {
        return { recordId: existing.id, request_id: existing.request_id ?? '' }
      }
    }

    const creditResult = await checkAndDeductCredits(data.accessToken, 'edit')
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    // Fetch source image storage path -- enforce ownership
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('storage_path, created_at, generation_metadata')
      .eq('id', sourceImageId)
      .eq('user_id', user.id)
      .single()

    if (!sourceImage?.storage_path) {
      throw new Error('Source image not found')
    }

    // Get signed URL and fetch image bytes
    const { data: signedUrlData } = await supabase.storage
      .from('user-images')
      .createSignedUrl(sourceImage.storage_path, 3600)

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to get signed URL for source image')
    }

    const imageRes = await fetch(signedUrlData.signedUrl)
    const buffer = await imageRes.arrayBuffer()

    // Upload to FAL storage using shared utility
    const falImageUrl = await uploadBufferToFal(buffer)

    // Fetch and upload reference images in parallel
    const referenceUrls: Array<string> = []
    if (referenceImageIds?.length) {
      const refImages = await supabase
        .from('user_images')
        .select('id, storage_path')
        .in('id', referenceImageIds)
        .eq('user_id', user.id)

      if (refImages.data?.length) {
        const uploads = await Promise.all(
          refImages.data.map(async (ref) => {
            if (!ref.storage_path) return null
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(ref.storage_path, 3600)
            if (!signed?.signedUrl) return null
            const res = await fetch(signed.signedUrl)
            const buf = await res.arrayBuffer()
            return uploadBufferToFal(buf)
          }),
        )
        referenceUrls.push(...uploads.filter((u): u is string => u !== null))
      }
    }

    // Submit to selected edit model using schema-driven param resolution
    const falInput = await buildFalInput({
      modelId: falEditModel,
      prompt: editPrompt.trim(),
      aspectRatio,
      imageUrls: [falImageUrl, ...referenceUrls],
      safetyLevel: 'permissive',
      extraParams: { num_images: numImagesToGenerate },
    })

    const webhookUrl =
      process.env.ENABLE_FAL_WEBHOOKS === 'true' && process.env.VITE_APP_URL
        ? `${process.env.VITE_APP_URL}/api/fal-webhook`
        : undefined

    let request_id: string
    try {
      const result = await (fal.queue.submit as any)(falEditModel, {
        input: falInput,
        ...(webhookUrl ? { webhookUrl } : {}),
      })
      request_id = result.request_id
    } catch (err) {
      await refundCredits(user.id, creditResult.cost, 'edit')
      throw err
    }

    const { recordId } = await createPendingGeneration({
      accessToken: data.accessToken,
      userId: user.id,
      requestId: request_id,
      generationType: 'edit',
      falModelId: falEditModel,
      prompt: editPrompt.trim(),
      aspectRatio,
      title: 'Editing...',
      idempotencyKey: data.idempotencyKey,
      extraMetadata: {
        source_image_id: sourceImageId,
        ...(referenceImageIds?.length
          ? { reference_image_ids: referenceImageIds }
          : {}),
      },
    })

    return { recordId, request_id }
  })
