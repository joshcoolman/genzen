import { getSupabaseAdmin } from './supabase-admin.server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/types/supabase'
import { getModelName } from '@/features/ai-images/models'

/** Title a generation row carries between being reserved and settling. */
export const PENDING_TITLE = 'Generating...'

interface CreatePendingGenerationOptions {
  userId: string
  /**
   * FAL's id for the queued job. Optional on purpose: the row is reserved
   * *before* the provider is contacted so that every outcome -- including a
   * submit that never happens -- leaves a visible record. Attach it afterwards
   * with `markGenerationSubmitted`.
   */
  requestId?: string
  /** Omitted for plain text-to-image, which has never carried one. */
  generationType?: string
  falModelId: string
  prompt: string
  aspectRatio?: string
  extraMetadata?: Record<string, unknown>
  title?: string
  idempotencyKey?: string
  /** Mark the row as living on the canvas, so it's reclaimable on canvas load */
  onCanvas?: boolean
  /** Overrides the default `Date.now() / 1000`, for ordering a batch */
  sortOrder?: number
}

export async function createPendingGeneration({
  userId,
  requestId,
  generationType,
  falModelId,
  prompt,
  aspectRatio,
  extraMetadata,
  title = PENDING_TITLE,
  idempotencyKey,
  onCanvas,
  sortOrder,
}: CreatePendingGenerationOptions): Promise<{ recordId: string }> {
  const supabase = getSupabaseAdmin()

  const model = falModelId.replace(/\/edit$/, '')

  const { data: record, error: insertError } = await supabase
    .from('user_images')
    .insert({
      user_id: userId,
      ...(requestId ? { request_id: requestId } : {}),
      status: 'pending',
      source: 'ai_generated',
      title,
      sort_order: sortOrder ?? Date.now() / 1000,
      ...(onCanvas ? { on_canvas: true } : {}),
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      generation_metadata: {
        prompt,
        model,
        fal_model_id: falModelId,
        ...(generationType ? { generation_type: generationType } : {}),
        submitted_at: new Date().toISOString(),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...extraMetadata,
      },
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create image record: ${insertError.message}`)
  }

  return { recordId: record.id }
}

/**
 * Attach the provider's request id once the job is actually queued. Until this
 * runs the row is a reservation: visible in the gallery as pending, but not yet
 * something the completion pollers can look up.
 *
 * `metadataPatch` merges into `generation_metadata` for the facts that are only
 * knowable after the fallible work has run — the resolved endpoint id, a prompt
 * that had to be derived from the source image, the cost estimate. Reserving
 * first means those cannot be part of the initial insert.
 */
export async function markGenerationSubmitted(
  recordId: string,
  requestId: string,
  metadataPatch?: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin()

  // `Json`-typed column: the generated Supabase types won't accept a bare
  // Record here, and the value is JSONB either way.
  let metadata: Json | undefined
  if (metadataPatch && Object.keys(metadataPatch).length > 0) {
    const { data: existing } = await supabase
      .from('user_images')
      .select('generation_metadata')
      .eq('id', recordId)
      .single()
    metadata = {
      ...((existing?.generation_metadata ?? {}) as Record<string, unknown>),
      ...metadataPatch,
    } as Json
  }

  await supabase
    .from('user_images')
    .update({
      request_id: requestId,
      ...(metadata ? { generation_metadata: metadata } : {}),
    })
    .eq('id', recordId)
}

/**
 * Turn an unknown thrown value into something worth showing on a failed card.
 *
 * `err.message` alone is not enough: the FAL client throws errors whose message
 * is an empty string, with the useful part on `body.detail` (often an array of
 * validation entries) or `status`. An empty `generation_error` is just the
 * silent failure again in a new place, so this always returns a non-empty
 * string.
 */
export function describeGenerationError(
  err: unknown,
  fallback: string,
): string {
  const parts: Array<string> = []

  if (err instanceof Error && err.message.trim()) parts.push(err.message.trim())

  const body = (err as { body?: unknown } | null)?.body
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      parts.push(detail.trim())
    } else if (Array.isArray(detail)) {
      for (const entry of detail) {
        if (typeof entry === 'string') {
          if (entry.trim()) parts.push(entry.trim())
          continue
        }
        const detailEntry = entry as { msg?: string; message?: string } | null
        const msg = detailEntry
          ? (detailEntry.msg ?? detailEntry.message)
          : null
        if (msg) parts.push(String(msg))
      }
    }
  }

  const status = (err as { status?: unknown } | null)?.status
  if (typeof status === 'number') parts.push(`HTTP ${status}`)

  if (!parts.length && typeof err === 'string' && err.trim())
    parts.push(err.trim())

  return parts.length ? parts.join(' — ') : fallback
}

/**
 * Record why a generation died, so the user gets a failed card with a reason
 * and a working Retry instead of silence.
 *
 * Deliberately swallows its own errors: this runs inside a catch block, and a
 * failure to *write* the failure must never replace the original error the
 * caller is about to rethrow. Uses the admin client because the user's token
 * may be the very thing that failed.
 */
export async function markGenerationFailed(
  recordId: string,
  message: string,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    await supabase
      .from('user_images')
      .update({
        status: 'failed',
        generation_error: message.slice(0, 1000),
        ...(await failureTitle(supabase, recordId)),
      })
      .eq('id', recordId)
  } catch (err) {
    console.error(`[generation] could not mark ${recordId} failed:`, err)
  }
}

/**
 * A row is titled 'Generating...' from the moment it is reserved, and success
 * renames it to the model. Failure used to leave the placeholder in place, so a
 * failed card -- and every trashed one after it -- read "Generating..." forever.
 * Returns a `title` patch, or nothing when the row already has a real one.
 */
export async function failureTitle(
  supabase: SupabaseClient,
  recordId: string,
): Promise<{ title?: string }> {
  const { data: record } = await supabase
    .from('user_images')
    .select('title, generation_metadata')
    .eq('id', recordId)
    .maybeSingle()

  if (record?.title && record.title !== PENDING_TITLE) return {}

  const meta = (record?.generation_metadata ?? {}) as Record<string, unknown>
  const model = (meta.model ?? meta.fal_model_id) as string | undefined
  if (!model) return {}
  return { title: getModelName(model) || model }
}
