import {
  downloadAndStoreImage,
  downloadAndStoreVideo,
} from './image-storage.server'
import { generateThumbnailInBackground } from './generate-thumbnail.server'
import { extractVideoPoster } from './video-poster.server'
import { failureTitle } from './create-pending-generation.server'
import { first, jsonb, sql } from './db.server'
import type { FalErrorBlob } from './fal-error.server'
import { createImageStorage } from '#/lib/image-storage'
import { modelTitleFor } from '#/features/ai-images/models'

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
    select generation_metadata from user_images
    where id = ${recordId} and user_id = ${userId}
  `,
  )

  const meta = record?.generation_metadata ?? {}
  const prompt = typeof meta.prompt === 'string' ? meta.prompt : ''
  // `fal_model_id` first: it is patched at submit to the *resolved* endpoint,
  // where `model` was stripped of any `/edit` at reserve. For a model that
  // registers its image endpoint with that suffix -- Seedream v4.5 does -- the
  // stripped id names nothing, and the row was titled with a raw endpoint id.
  const model =
    typeof meta.fal_model_id === 'string'
      ? meta.fal_model_id
      : typeof meta.model === 'string'
        ? meta.model
        : ''

  const falCostCents = extractFalCostCents(falResultData)
  const estimatedCostCents =
    typeof meta.estimated_cost_cents === 'number'
      ? meta.estimated_cost_cents
      : null
  // The submit-time estimate, unless FAL reported a cost -- which it never has
  // on an image result. #410 put a third term between these, pricing the
  // `compute seconds` models from the result's own timings; that came out 4.5x
  // under what FAL actually billed, because the rate it read was a placeholder.
  // Deleted rather than corrected: no endpoint is really billed that way.
  const providerCostCents = falCostCents ?? estimatedCostCents
  // Activity is the only spend guard now, so it must not present a figure
  // derived from the rate card as something FAL reported.
  const providerCostIsEstimate = falCostCents == null

  let written
  try {
    written = await sql`
      update user_images
      set status = 'completed',
          storage_path = ${storagePath},
          thumbnail_path = null,
          file_name = ${fileName},
          file_hash = ${fileHash},
          file_size = ${fileSize},
          mime_type = 'image/png',
          title = ${modelTitleFor(model)},
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
      where id = ${recordId} and user_id = ${userId}
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

  // No row to point at the object, and no error to say so -- an update that
  // matches nothing succeeds. Since #369 that is a real outcome rather than an
  // impossible one: cancelling a generation deletes its row, and a poll already
  // in flight arrives to find it gone. Same cleanup as the catch above, because
  // the orphan is the same orphan; not an error, because the row is missing
  // exactly as intended.
  if (written.count === 0) {
    await createImageStorage().remove([storagePath])
    console.warn(
      `[fal-completion] record=${recordId} no longer exists; discarded the result`,
    )
    return
  }

  generateThumbnailInBackground(userId, storagePath, recordId)
}

/**
 * The video sibling of `processImageResult` (#305).
 *
 * A separate function rather than a branch inside that one: the result shape
 * differs (`{ video: { url } }` against `{ images: [{ url }] }`), and so does
 * everything downstream -- the poster comes out of a container rather than off
 * a still, and the FAL URL is kept in metadata as the degradation path when a
 * later ingest fails.
 *
 * Frame one becomes `thumbnail_path`, and `width`/`height` come off that frame
 * (#499). Inline rather than fire-and-forget like the image thumbnail: the
 * bytes are already in hand, it is a few hundred milliseconds against a
 * generation that took 30-300 seconds, and it lands everything in one write. A
 * clip whose poster fails keeps NULL columns and the `<video
 * preload="metadata">` tile it had before.
 */
export async function processVideoResult(
  recordId: string,
  userId: string,
  falResultData: Record<string, unknown>,
) {
  const videoUrl = (falResultData as { video?: { url?: string } }).video?.url
  if (!videoUrl) {
    throw new Error('No video URL in FAL result')
  }

  const { storagePath, fileName, fileHash, fileSize, bytes } =
    await downloadAndStoreVideo(userId, videoUrl)

  const poster = await extractVideoPoster(userId, storagePath, bytes)

  const record = first(
    await sql<Array<{ generation_metadata: Record<string, unknown> | null }>>`
    select generation_metadata from user_images
    where id = ${recordId} and user_id = ${userId}
  `,
  )

  const meta = record?.generation_metadata ?? {}
  const prompt = typeof meta.prompt === 'string' ? meta.prompt : ''
  // The label is read from the row, not from a catalog. That started as a
  // constraint -- the lineup was route-owned and a `.server.ts` module must not
  // reach into a route folder -- and since #398 promoted it to
  // `src/features/video/models` it is a choice. Still the right one: the label
  // was pinned at submit time, so cutting a model from the lineup does not
  // rename the clips it made.
  const title =
    (typeof meta.model_label === 'string' ? meta.model_label : '') ||
    (typeof meta.model === 'string' ? meta.model : '') ||
    'Video'

  // Same honesty as images: a figure derived from our own rate table must not
  // be presented as something FAL reported. Video is the case where the
  // estimate is reliable -- price is per second and the duration was chosen up
  // front -- but that does not make it a provider figure.
  const falCostCents = extractFalCostCents(falResultData)
  const estimatedCostCents =
    typeof meta.estimated_cost_cents === 'number'
      ? meta.estimated_cost_cents
      : null
  const providerCostCents = falCostCents ?? estimatedCostCents
  const providerCostIsEstimate = falCostCents == null

  try {
    await sql`
      update user_images
      set status = 'completed',
          storage_path = ${storagePath},
          thumbnail_path = ${poster?.thumbnailPath ?? null},
          width = ${poster?.width ?? null},
          height = ${poster?.height ?? null},
          file_name = ${fileName},
          file_hash = ${fileHash},
          file_size = ${fileSize},
          mime_type = 'video/mp4',
          title = ${title},
          description = ${
            prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt
          },
          generation_metadata =
            coalesce(generation_metadata, '{}'::jsonb) || ${jsonb({
              // Kept deliberately: if a future ingest change fails midway, a
              // playable link beats a dead record. Not the source of truth --
              // `storage_path` is, and `/img/[id]` is the only URL the UI uses.
              fal_video_url: videoUrl,
              timings: falResultData.timings,
              completed_at: new Date().toISOString(),
              ...(providerCostCents != null && {
                provider_cost_cents: providerCostCents,
                provider_cost_is_estimate: providerCostIsEstimate,
              }),
            })}
      where id = ${recordId} and user_id = ${userId}
    `
  } catch (err) {
    // The poster goes with the clip -- otherwise the row is gone and a stray
    // thumbnail sits in the bucket with nothing referencing it.
    await createImageStorage().remove(
      poster ? [storagePath, poster.thumbnailPath] : [storagePath],
    )
    throw new Error(
      `Update failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export async function markGenerationFailed(recordId: string, errorMsg: string) {
  // sql-scope-exempt: `recordId` comes from the poll scan, which is its own
  // `user_id`-filtered select. Not a caller naming a row.
  await sql`
    update user_images
    set status = 'failed', generation_error = ${errorMsg}
    where id = ${recordId}
  `
}

/**
 * Failure path that preserves the full structured FAL error blob in
 * generation_metadata.error while mirroring the human message to
 * generation_error, so the UI (which reads generation_error) and the detail
 * panel (which reads generation_metadata.error) both get the truth.
 */
export async function markGenerationFailedWithBlob(
  recordId: string,
  blob: FalErrorBlob,
) {
  const title = await failureTitle(recordId)

  // sql-scope-exempt: same provenance as markGenerationFailed above -- the
  // poll scan's own user_id-filtered select.
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
