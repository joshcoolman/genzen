import { first, jsonb, sql } from './db.server'
import { addCanvasMembers, requireCanvas } from './canvas-membership.server'
import type { GenerationOrigin } from '#/lib/types/db'
import { modelTitleFor } from '#/features/ai-images/models'

/**
 * The title rows carried between being reserved and settling, until #367.
 *
 * A reserve now writes the model name straight away -- it is known at that
 * moment, and a badge that renames itself on settle was the card admitting it
 * had been guessing. Kept only to recognise rows written before that change:
 * `failureTitle` still repairs them, and until the last one is out of Trash
 * this string is the only way to tell a placeholder from a real title.
 */
export const PENDING_TITLE = 'Generating...'

interface CreatePendingGenerationOptions {
  userId: string
  /** Required, and deliberately not defaulted: origin by omission is the defect
   *  #207 exists to fix. */
  origin: GenerationOrigin
  /**
   * FAL's id for the queued job. Optional on purpose: the row is reserved
   * *before* the provider is contacted so that every outcome -- including a
   * submit that never happens -- leaves a visible record. Attach it afterwards
   * with `markGenerationSubmitted`.
   */
  requestId?: string
  /** Omitted for plain text-to-image, which has never carried one. */
  generationType?: string
  /**
   * What the row will hold once it settles. Defaults to `ai_generated`; video
   * passes `ai_video` (#305), which is what keeps clips out of the gallery
   * query and routes the poll to the right completion handler.
   */
  source?: 'ai_generated' | 'ai_video'
  falModelId: string
  prompt: string
  aspectRatio?: string
  extraMetadata?: Record<string, unknown>
  /** Defaults to the model's own name (#367). Video passes its label, which
   *  lives in a route-owned catalog this module must not import. */
  title?: string
  idempotencyKey?: string
  /** Put the row on this canvas, so the generation is reclaimable on canvas
   *  load. The board says which one now that there are several (#446); it is
   *  verified against the caller's user id before a membership row is written. */
  canvasId?: string
  /** File the row into a group at birth (#319). This is the half of grouping
   *  that makes it not a folder: you declare where you are working once, and
   *  the filing is a byproduct rather than a chore afterwards. */
  groupId?: string | null
  /** Overrides the default `Date.now() / 1000`, for ordering a batch */
  sortOrder?: number
}

export async function createPendingGeneration({
  userId,
  origin,
  requestId,
  generationType,
  source = 'ai_generated',
  falModelId,
  prompt,
  aspectRatio,
  extraMetadata,
  // Bound after `falModelId` on purpose: the default reads it.
  title = modelTitleFor(falModelId),
  idempotencyKey,
  canvasId,
  groupId,
  sortOrder,
}: CreatePendingGenerationOptions): Promise<{ recordId: string }> {
  const model = falModelId.replace(/\/edit$/, '')

  // The group id reaches here from the browser, and the foreign key alone would
  // happily accept a stranger's group -- the row would be invisible to both
  // users but written into someone else's set. Confirmed against `user_id`
  // first, and an id that does not resolve files the image at top level rather
  // than failing the generation: a wrong group is worth losing, a picture is
  // not.
  const owned = groupId
    ? first(
        await sql<Array<{ id: string }>>`
          select id from image_groups
          where id = ${groupId} and user_id = ${userId}
        `,
      )
    : null

  const row = {
    user_id: userId,
    ...(requestId ? { request_id: requestId } : {}),
    status: 'pending',
    source,
    origin,
    title,
    sort_order: sortOrder ?? Date.now() / 1000,
    ...(owned ? { group_id: owned.id } : {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    generation_metadata: jsonb({
      prompt,
      model,
      fal_model_id: falModelId,
      ...(generationType ? { generation_type: generationType } : {}),
      submitted_at: new Date().toISOString(),
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...extraMetadata,
    }),
  }

  const record = first(
    // sql-scope-exempt: an insert scopes by what it writes, and `row` carries
    // user_id from resolveAuth(). There is no filter to add.
    await sql<Array<{ id: string }>>`
    insert into user_images ${sql(row)} returning id
  `,
  )

  if (!record) throw new Error('Failed to create image record')

  // Membership at reserve time, unplaced: this is what makes a canvas
  // generation reclaimable when the client navigates away before FAL answers.
  // The client has not decided where the card goes yet, and under #212 it does
  // not have to -- the load pass places whatever is unplaced.
  if (canvasId) {
    await requireCanvas(userId, canvasId)
    await addCanvasMembers(userId, canvasId, [{ imageId: record.id }])
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
  // The patch merges in the database rather than read-modify-write, so a
  // concurrent writer to the same row cannot have its keys dropped.
  const patch =
    metadataPatch && Object.keys(metadataPatch).length > 0
      ? metadataPatch
      : null

  // sql-scope-exempt: `recordId` is never caller-supplied. Both callers pass a
  // row this server just inserted -- generate-image-internal its reservation,
  // retry-generation the row it re-selected under `user_id = ${userId}`.
  await sql`
    update user_images
    set request_id = ${requestId}
        ${
          patch
            ? sql`, generation_metadata =
                coalesce(generation_metadata, '{}'::jsonb) || ${jsonb(patch)}`
            : sql``
        }
    where id = ${recordId}
  `
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
 * caller is about to rethrow.
 */
export async function markGenerationFailed(
  recordId: string,
  message: string,
): Promise<void> {
  try {
    const title = await failureTitle(recordId)
    // sql-scope-exempt: `recordId` is never caller-supplied -- see
    // markGenerationSubmitted above; the callers are the same two paths.
    await sql`
      update user_images
      set status = 'failed',
          generation_error = ${message.slice(0, 1000)}
          ${title ? sql`, title = ${title}` : sql``}
      where id = ${recordId}
    `
  } catch (err) {
    console.error(`[generation] could not mark ${recordId} failed:`, err)
  }
}

/**
 * Repairs a row still titled 'Generating...' when it fails.
 *
 * Since #367 a reserve writes the model name, so a row reaching here with a
 * real title is the normal case and this returns null. It stays for the rows
 * written before that -- including every stuck-pending row #363 now fails off,
 * which is precisely the population titled 'Generating...' -- and can go once
 * none are left. Returns a replacement title, or null to leave the title alone.
 */
export async function failureTitle(recordId: string): Promise<string | null> {
  const record = first(
    // sql-scope-exempt: reached only from the two mark-failed paths, each
    // already holding a row it created or re-selected under its own user_id.
    await sql<
      Array<{
        title: string
        generation_metadata: Record<string, unknown> | null
      }>
    >`
    select title, generation_metadata from user_images where id = ${recordId}
  `,
  )

  if (!record) return null
  if (record.title && record.title !== PENDING_TITLE) return null

  const meta = record.generation_metadata ?? {}
  // `fal_model_id` first, for the same reason the completion path prefers it:
  // it is the resolved endpoint, and `model` was stripped of any `/edit`.
  const model = (meta.fal_model_id ?? meta.model) as string | undefined
  if (!model) return null
  return modelTitleFor(model)
}
