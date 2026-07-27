import { fal } from '@fal-ai/client'
import { buildFalInput } from './fal-params.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '#/lib/server/create-pending-generation.server'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '#/lib/server/fal-webhook-url.server'
import { createImageStorage } from '#/lib/image-storage'
import { computeFalCostCents } from '#/lib/server/compute-cost.server'

export interface EditImageInput {
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
  const { userId } = await resolveAuth()

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
    const existing = first(
      await sql<
        Array<{ id: string; request_id: string | null; status: string }>
      >`
      select id, request_id, status from user_images
      where idempotency_key = ${data.idempotencyKey} and user_id = ${userId}
    `,
    )
    if (existing && existing.status !== 'failed') {
      return { recordId: existing.id, request_id: existing.request_id ?? '' }
    }
  }

  // Reserve the row BEFORE anything that can fail. From here on every outcome
  // is visible: a pending card that either completes or flips to a failed card
  // carrying its reason and a working Retry. `request_id` is attached later,
  // once FAL has actually accepted the job.
  const { recordId } = await createPendingGeneration({
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
    // Log server-side: a swallowed generation error is exactly what made this
    // class of bug invisible in the first place.
    console.error('[edit] generation failed', recordId, err)
    const message = describeGenerationError(err, 'Edit failed')
    await markGenerationFailed(recordId, message)
    // Rethrown so the client can toast. The card is already marked failed.
    throw err
  }

  async function runEdit(reservedId: string) {
    if (!process.env.FAL_KEY) {
      throw new Error(
        'FAL_KEY is not set — add it to .env.local and restart the dev server',
      )
    }

    // Fetch source image storage path -- enforce ownership
    const sourceImage = first(
      await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${sourceImageId} and user_id = ${userId}
    `,
    )

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
      const refImages = await sql<
        Array<{ id: string; storage_path: string | null }>
      >`
        select id, storage_path from user_images
        where id in ${sql(referenceImageIds)} and user_id = ${userId}
      `

      if (refImages.length) {
        const uploads = await Promise.all(
          refImages.map(async (ref) => {
            if (!ref.storage_path) return null
            const refSignedUrl = await storage.getUrl(ref.storage_path)
            if (!refSignedUrl) return null
            const res = await fetch(refSignedUrl)
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

    const webhookUrl = getFalWebhookUrl()

    const { request_id } = await (fal.queue.submit as any)(falEditModel, {
      input: falInput,
      ...(webhookUrl ? { webhookUrl } : {}),
    })

    const estimatedCostCents = await computeFalCostCents(falEditModel, {
      aspectRatio,
      quantity: numImagesToGenerate,
    }).catch(() => null)

    await markGenerationSubmitted(
      reservedId,
      request_id,
      estimatedCostCents != null
        ? { estimated_cost_cents: estimatedCostCents }
        : undefined,
    )

    return { recordId: reservedId, request_id }
  }
}
