import { downloadAndStoreImage } from './image-storage.server'
import { generateThumbnailInBackground } from './generate-thumbnail.server'
import { failureTitle } from './create-pending-generation.server'
import { first, jsonb, sql } from './db.server'
import type { FalErrorBlob } from './fal-error.server'
import { createImageStorage } from '#/lib/image-storage'
import { getModelName } from '#/features/ai-images/models'

// Defensive extractor — FAL doesn't expose cost consistently across endpoints,
// and in practice its image queue results carry no cost field at all, so this
// usually returns null and the caller falls back to the submit-time estimate.
// Probes known candidate paths; expand if a real response ever carries one.
function extractFalCostCents(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data || typeof data !== 'object') return null
  const pickNumber = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  const direct = pickNumber(data.cost_cents) ?? pickNumber(data.price_cents)
  if (direct != null) return Math.round(direct)

  const dollarsLike = pickNumber(data.cost) ?? pickNumber(data.price)
  if (dollarsLike != null) return Math.round(dollarsLike * 100)

  const metering = (data as { metering?: Record<string, unknown> }).metering
  if (metering && typeof metering === 'object') {
    const m =
      pickNumber(metering.cost_cents) ?? pickNumber(metering.price_cents)
    if (m != null) return Math.round(m)
    const d = pickNumber(metering.cost) ?? pickNumber(metering.price)
    if (d != null) return Math.round(d * 100)
  }

  const billing = (data as { fal_billing?: Record<string, unknown> })
    .fal_billing
  if (billing && typeof billing === 'object') {
    const b = pickNumber(billing.cost_cents) ?? pickNumber(billing.price_cents)
    if (b != null) return Math.round(b)
    const d = pickNumber(billing.cost) ?? pickNumber(billing.price)
    if (d != null) return Math.round(d * 100)
  }

  return null
}

export async function processImageResult(
  recordId: string,
  userId: string,
  falResultData: Record<string, unknown>,
) {
  const imageUrl = (falResultData as { images?: Array<{ url?: string }> })
    .images?.[0]?.url
  if (!imageUrl) {
    throw new Error('No image URL in FAL result')
  }

  const { storagePath, fileName, fileHash, fileSize } =
    await downloadAndStoreImage(userId, imageUrl)

  // Read the metadata for the facts the title and description are derived
  // from. The write below merges with `||` rather than replacing, so a key
  // written between these two statements survives.
  const record = first(
    await sql<Array<{ generation_metadata: Record<string, unknown> | null }>>`
    select generation_metadata from user_images where id = ${recordId}
  `,
  )

  const meta = record?.generation_metadata ?? {}
  const prompt = typeof meta.prompt === 'string' ? meta.prompt : ''
  const model =
    typeof meta.model === 'string'
      ? meta.model
      : typeof meta.fal_model_id === 'string'
        ? meta.fal_model_id
        : ''

  const falCostCents = extractFalCostCents(falResultData)
  const estimatedCostCents =
    typeof meta.estimated_cost_cents === 'number'
      ? meta.estimated_cost_cents
      : null
  const providerCostCents = falCostCents ?? estimatedCostCents
  // Activity is the only spend guard now, so it must not present a figure
  // derived from the pricing table as something FAL reported.
  const providerCostIsEstimate = falCostCents == null

  try {
    await sql`
      update user_images
      set status = 'completed',
          storage_path = ${storagePath},
          thumbnail_path = null,
          file_name = ${fileName},
          file_hash = ${fileHash},
          file_size = ${fileSize},
          mime_type = 'image/png',
          title = ${getModelName(model) || model},
          description = ${
            prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt
          },
          generation_metadata =
            coalesce(generation_metadata, '{}'::jsonb) || ${jsonb({
              seed: falResultData.seed,
              timings: falResultData.timings,
              completed_at: new Date().toISOString(),
              ...(providerCostCents != null && {
                provider_cost_cents: providerCostCents,
                provider_cost_is_estimate: providerCostIsEstimate,
              }),
            })}
      where id = ${recordId}
    `
  } catch (err) {
    // The file landed in storage before the row could point at it. Without
    // this the object is orphaned -- nothing references it and nothing will
    // ever clean it up.
    await createImageStorage().remove([storagePath])
    throw new Error(
      `Update failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  generateThumbnailInBackground(userId, storagePath, recordId)
}

export async function markGenerationFailed(recordId: string, errorMsg: string) {
  await sql`
    update user_images
    set status = 'failed', generation_error = ${errorMsg}
    where id = ${recordId}
  `
}

/**
 * Failure path that preserves the full structured FAL error blob in
 * generation_metadata.error while mirroring the human message to
 * generation_error. Used by the poll path and the webhook handler so the
 * UI (which reads generation_error today) and the future Phase 4 detail
 * panel (which reads generation_metadata.error) both get the truth.
 */
export async function markGenerationFailedWithBlob(
  recordId: string,
  blob: FalErrorBlob,
) {
  const title = await failureTitle(recordId)

  await sql`
    update user_images
    set status = 'failed',
        generation_error = ${blob.message},
        generation_metadata =
          coalesce(generation_metadata, '{}'::jsonb) || ${jsonb({ error: blob })}
        ${title ? sql`, title = ${title}` : sql``}
    where id = ${recordId}
  `
}
