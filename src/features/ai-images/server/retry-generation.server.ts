'use server'

import { fal } from '@fal-ai/client'
import { endpointFor } from '../models'
import { RetryNotReproducible, planHasImages, planRetry } from '../retry-plan'
import { buildFalInput } from './fal-params.server'
import type { RetryMetadata } from '../retry-plan'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { getFalWebhookUrl } from '#/lib/server/fal-webhook-url.server'
import { fetchAndUploadToFal } from '#/lib/server/fal-image-upload.server'
import {
  resolveLibraryImageUrl,
  uploadLibraryImagesToFal,
} from '#/lib/server/fal-image-inputs.server'
import { computeFalCostCents } from '#/lib/server/compute-cost.server'
import {
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '#/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface RetryGenerationInput {
  recordId: string
}

export async function retryGeneration(data: RetryGenerationInput) {
  const { userId } = await resolveAuth()

  // Checked inside the reserved-row block below (see the note in
  // edit-image-internal.server.ts): a missing key must produce a visible
  // failed card, not a silent throw.

  // Fetch the failed record
  const record = first(
    await sql<
      Array<{ id: string; status: string; generation_metadata: unknown }>
    >`
    select id, status, generation_metadata
    from user_images
    where id = ${data.recordId} and user_id = ${userId} and status = 'failed'
  `,
  )

  if (!record) {
    throw new Error('Record not found or not in failed state')
  }

  // Pure, and before the row is touched: an unreproducible retry must leave the
  // card exactly as it was, showing its original error rather than a fresh one.
  const plan = planRetry(record.generation_metadata as RetryMetadata)
  const meta = record.generation_metadata as RetryMetadata

  // Derived, never read from the row. `fal_model_id` is written at reserve time
  // as the base model and only patched to the resolved endpoint at submit, so a
  // generation that failed *before* submit kept the text-to-image endpoint --
  // and those are exactly the rows a user retries.
  const falModelId = endpointFor(plan.model, planHasImages(plan))

  // A retry reuses the failed row rather than inserting a new one. Retrying is
  // "try that again", not "make another" -- a new row left the original behind
  // as a second card the user then had to clean up, and the row it left was a
  // failure, which is exactly what they were trying to be rid of.
  //
  // It still obeys the reserve-then-submit rule: the row goes back to `pending`
  // before FAL is contacted, so a retry that fails again lands back on the same
  // card rather than disappearing.
  const retryCount =
    typeof (meta as { retry_count?: number }).retry_count === 'number'
      ? (meta as { retry_count: number }).retry_count + 1
      : 1

  // `- 'error'` drops the previous failure's structured blob, or Activity would
  // show the old error against a row that is running again. Merging with `||`
  // rather than writing `meta` back wholesale keeps whatever else is in there.
  await sql`
    update user_images
    set status = 'pending',
        generation_error = null,
        request_id = null,
        generation_metadata =
          (coalesce(generation_metadata, '{}'::jsonb) - 'error')
            || ${jsonb({
              retry_count: retryCount,
              submitted_at: new Date().toISOString(),
            })}
    where id = ${data.recordId} and user_id = ${userId}
  `

  const newRecord = { id: data.recordId }

  try {
    if (!process.env.FAL_KEY) {
      throw new Error(
        'FAL_KEY is not set — add it to .env.local and restart the dev server',
      )
    }

    // Every image goes to FAL as bytes. The source used to be handed over as a
    // URL (unfetchable locally) or, for a library source, dropped entirely --
    // so the most common retry in the app silently went out text-only against
    // an image endpoint (#214).
    const sourceUrl =
      plan.source.kind === 'library'
        ? await resolveLibraryImageUrl(plan.source.imageId, userId)
        : plan.source.kind === 'url'
          ? plan.source.url
          : null

    if (plan.source.kind !== 'none' && !sourceUrl) {
      throw new RetryNotReproducible(
        'The source image for this generation is no longer available, so it cannot be sent again.',
      )
    }

    const [uploadedSource, referenceUrls] = await Promise.all([
      sourceUrl ? fetchAndUploadToFal(sourceUrl) : Promise.resolve(null),
      uploadLibraryImagesToFal(plan.referenceImageIds, userId),
    ])

    // Source first, then references: models read the list positionally and the
    // prompt labels them "[Image 1, Image 2, ...]".
    const imageUrls = [
      ...(uploadedSource ? [uploadedSource] : []),
      ...referenceUrls,
    ]

    const falInput = await buildFalInput({
      modelId: falModelId,
      prompt: plan.prompt,
      aspectRatio: plan.aspectRatio,
      ...(imageUrls.length > 0 ? { imageUrls } : {}),
      safetyLevel: 'permissive',
    })

    const webhookUrl = getFalWebhookUrl()
    const { request_id } = await (fal.queue.submit as any)(falModelId, {
      input: falInput,
      ...(webhookUrl ? { webhookUrl } : {}),
    })
    const estimatedCostCents = await computeFalCostCents(falModelId, {
      aspectRatio: plan.aspectRatio,
    }).catch(() => null)
    await markGenerationSubmitted(newRecord.id, request_id, {
      // Record the endpoint actually used, the way generate does. The stored
      // one can be the base model (see the derivation above), so without this
      // the row keeps claiming a text-only endpoint for a run that sent images.
      fal_model_id: falModelId,
      ...(estimatedCostCents != null
        ? { estimated_cost_cents: estimatedCostCents }
        : {}),
    })
  } catch (err) {
    console.error('[retry] generation failed', newRecord.id, err)
    await markGenerationFailed(
      newRecord.id,
      describeGenerationError(err, 'Retry failed'),
    )
    throw err
  }

  return { recordId: newRecord.id }
}
