import { fal } from '@fal-ai/client'
import { buildFalInput } from './fal-params.server'
import { resolveAuth } from '@/lib/server/auth.server'
import {
  checkAndDeductCredits,
  withCreditRefund,
} from '@/features/credits/server/check-credits.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '@/lib/server/create-pending-generation.server'
import { checkRateLimit } from '@/lib/server/rate-limit.server'
import { uploadBufferToFal } from '@/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { createImageStorage } from '@/lib/image-storage'

export interface EditImageInput {
  accessToken?: string
  userId?: string
  sourceImageId: string
  parentId?: string // Optional organizational parent (defaults to sourceImageId)
  editPrompt: string
  aspectRatio?: string
  editModelId?: string
  referenceImageIds?: Array<string>
  numImages?: number
  idempotencyKey?: string
  sourceClient?: string
}

export interface EditImageResult {
  recordId: string
  request_id: string
}

/**
 * Plain async implementation. See generateImageInternal docstring for
 * why this is split out from the createServerFn wrapper.
 */
export async function editImageInternal(
  data: EditImageInput,
): Promise<EditImageResult> {
  const { userId, supabase } = await resolveAuth({
    accessToken: data.accessToken,
    userId: data.userId,
  })
  await checkRateLimit(userId, 'image')

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

  // NOTE: the FAL_KEY check deliberately does NOT live here. A missing key is
  // just one failure among many, and failing before the row is reserved is what
  // used to make a click vanish without a card, an Activity entry, or a retry.
  // It is checked inside the reserved-row try block below.

  // Idempotency: if key provided and a non-failed record exists, return it
  if (data.idempotencyKey) {
    const { data: existing } = await supabase
      .from('user_images')
      .select('id, request_id, status')
      .eq('idempotency_key', data.idempotencyKey)
      .eq('user_id', userId)
      .single()
    if (existing && existing.status !== 'failed') {
      return { recordId: existing.id, request_id: existing.request_id ?? '' }
    }
  }

  const creditResult = await checkAndDeductCredits({ userId }, 'edit')
  if (!creditResult.allowed) {
    throw new Error('Insufficient credits')
  }

  return withCreditRefund(
    creditResult.userId,
    creditResult.cost,
    'edit',
    async () => {
      // Reserve the row BEFORE anything that can fail. From here on every
      // outcome is visible: a pending card that either completes or flips to a
      // failed card carrying its reason and a working Retry. `request_id` is
      // attached later, once FAL has actually accepted the job.
      const { recordId } = await createPendingGeneration({
        accessToken: data.accessToken,
        userId,
        generationType: 'edit',
        falModelId: falEditModel,
        prompt: editPrompt.trim(),
        aspectRatio,
        title: 'Editing...',
        idempotencyKey: data.idempotencyKey,
        extraMetadata: {
          source_image_id: sourceImageId, // Immutable: actual generation source
          parent_id: data.parentId ?? sourceImageId, // Mutable: group parent
          ...(referenceImageIds?.length
            ? { reference_image_ids: referenceImageIds }
            : {}),
          ...(data.sourceClient ? { source_client: data.sourceClient } : {}),
        },
      })

      try {
        return await runEdit(recordId)
      } catch (err) {
        // Log server-side: a swallowed generation error is exactly what made
        // this class of bug invisible in the first place.
        console.error('[edit] generation failed', recordId, err)
        const message = describeGenerationError(err, 'Edit failed')
        await markGenerationFailed(recordId, message)
        // Rethrown so withCreditRefund still refunds and the client can toast.
        throw err
      }

      async function runEdit(reservedId: string) {
        if (!process.env.FAL_KEY) {
          throw new Error(
            'FAL_KEY is not set — add it to .env.local and restart the dev server',
          )
        }

        // Fetch source image storage path -- enforce ownership
        const { data: sourceImage } = await supabase
          .from('user_images')
          .select('storage_path, created_at, generation_metadata')
          .eq('id', sourceImageId)
          .eq('user_id', userId)
          .single()

        if (!sourceImage?.storage_path) {
          throw new Error('Source image not found')
        }

        // Get signed URL and fetch image bytes
        const storage = createImageStorage()
        const signedUrl = await storage.getUrl(sourceImage.storage_path)

        if (!signedUrl) {
          throw new Error('Failed to get signed URL for source image')
        }

        const imageRes = await fetch(signedUrl)
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
            .eq('user_id', userId)

          if (refImages.data?.length) {
            const uploads = await Promise.all(
              refImages.data.map(async (ref) => {
                if (!ref.storage_path) return null
                const refSignedUrl = await storage.getUrl(ref.storage_path)
                if (!refSignedUrl) return null
                const res = await fetch(refSignedUrl)
                const buf = await res.arrayBuffer()
                return uploadBufferToFal(buf)
              }),
            )
            referenceUrls.push(
              ...uploads.filter((u): u is string => u !== null),
            )
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

        const webhookUrl = getFalWebhookUrl()

        const { request_id } = await (fal.queue.submit as any)(falEditModel, {
          input: falInput,
          ...(webhookUrl ? { webhookUrl } : {}),
        })

        await markGenerationSubmitted(reservedId, request_id)

        return { recordId: reservedId, request_id }
      }
    },
  )
}
