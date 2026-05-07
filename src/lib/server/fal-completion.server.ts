import { downloadAndStoreImage } from './image-storage.server'
import { generateThumbnailInBackground } from './generate-thumbnail.server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FalErrorBlob } from './fal-error.server'
import { createImageStorage } from '@/lib/image-storage'

// Defensive extractor — FAL doesn't expose cost consistently across endpoints.
// Probes known candidate paths; returns null if none match. Verify + expand as
// real response shapes land.
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
  supabase: SupabaseClient,
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
    await downloadAndStoreImage(supabase, userId, imageUrl)

  // Fetch current metadata to merge
  const { data: record } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('id', recordId)
    .single()

  const meta = (record?.generation_metadata ?? {}) as Record<string, unknown>
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

  const { error: updateError } = await supabase
    .from('user_images')
    .update({
      status: 'completed',
      storage_path: storagePath,
      thumbnail_path: null,
      file_name: fileName,
      file_hash: fileHash,
      file_size: fileSize,
      mime_type: 'image/png',
      title: model,
      description:
        prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt,
      generation_metadata: {
        ...meta,
        seed: falResultData.seed,
        timings: falResultData.timings,
        completed_at: new Date().toISOString(),
        ...(providerCostCents != null && {
          provider_cost_cents: providerCostCents,
        }),
      },
    })
    .eq('id', recordId)

  if (updateError) {
    await createImageStorage(supabase).remove([storagePath])
    throw new Error(`Update failed: ${updateError.message}`)
  }

  generateThumbnailInBackground(supabase, userId, storagePath, recordId)
}

export async function processVideoResult(
  supabase: SupabaseClient,
  recordId: string,
  falResultData: Record<string, unknown>,
) {
  const videoUrl = (falResultData as { video?: { url?: string } }).video?.url
  if (!videoUrl) {
    throw new Error('No video URL in FAL result')
  }

  const { data: record } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('id', recordId)
    .single()

  const meta = (record?.generation_metadata ?? {}) as Record<string, unknown>
  const falCostCents = extractFalCostCents(falResultData)
  const estimatedCostCents =
    typeof meta.estimated_cost_cents === 'number'
      ? meta.estimated_cost_cents
      : null
  const providerCostCents = falCostCents ?? estimatedCostCents

  const { error: updateError } = await supabase
    .from('user_images')
    .update({
      status: 'completed',
      title: 'Generated video',
      generation_metadata: {
        ...meta,
        fal_url: videoUrl,
        completed_at: new Date().toISOString(),
        ...(providerCostCents != null && {
          provider_cost_cents: providerCostCents,
        }),
      },
    })
    .eq('id', recordId)

  if (updateError) {
    throw new Error(`Update failed: ${updateError.message}`)
  }
}

export async function markGenerationFailed(
  supabase: SupabaseClient,
  recordId: string,
  errorMsg: string,
) {
  await supabase
    .from('user_images')
    .update({
      status: 'failed',
      generation_error: errorMsg,
    })
    .eq('id', recordId)
}

/**
 * Failure path that preserves the full structured FAL error blob in
 * generation_metadata.error while mirroring the human message to
 * generation_error. Used by the poll path and the webhook handler so the
 * UI (which reads generation_error today) and the future Phase 4 detail
 * panel (which reads generation_metadata.error) both get the truth.
 */
export async function markGenerationFailedWithBlob(
  supabase: SupabaseClient,
  recordId: string,
  blob: FalErrorBlob,
) {
  const { data: record } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('id', recordId)
    .single()

  const meta = (record?.generation_metadata ?? {}) as Record<string, unknown>

  await supabase
    .from('user_images')
    .update({
      status: 'failed',
      generation_error: blob.message,
      generation_metadata: { ...meta, error: blob },
    })
    .eq('id', recordId)
}
