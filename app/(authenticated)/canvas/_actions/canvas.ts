'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import {
  addCanvasMembers,
  ensureDefaultCanvas,
  removeCanvasMembers,
} from '#/lib/server/canvas-membership.server'

// The canvas's reads and writes, which the browser used to run directly against
// Supabase (#173). As elsewhere, `user_id` comes from `resolveAuth()` -- which
// is the real change here: `setOnCanvas`, `moveToTrash` and the membership read
// were all id-only queries, so an id from anywhere flipped or trashed a row.
//
// Everything here is user-scoped and returns plain data; the fail-safe
// behaviour the canvas relies on (a failed reconcile must never prune a live
// image) stays in `lib/persistence.ts`, which wraps these calls.

export interface CanvasDbRecord {
  id: string
  storage_path: string | null
  status: string | null
  generation_metadata: Record<string, unknown> | null
}

/** Every image the DB considers on-canvas -- the membership source of truth. */
export async function listOnCanvasRecords(): Promise<Array<CanvasDbRecord>> {
  const { userId } = await resolveAuth()

  return sql<Array<CanvasDbRecord>>`
    select id, storage_path, status, generation_metadata
    from user_images
    where user_id = ${userId} and on_canvas = true and deleted_at is null
  `
}

/**
 * Of the given record ids, those that are gone -- hard-deleted (row missing) or
 * soft-deleted (`deleted_at` set). The canvas prunes on this, so it is stated
 * as "not proven alive": anything the query does return without a `deleted_at`
 * is live and is never in the result.
 */
export async function listDeadRecordIds(
  ids: Array<string>,
): Promise<Array<string>> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return []

  const { userId } = await resolveAuth()

  const alive = await sql<Array<{ id: string }>>`
    select id from user_images
    where user_id = ${userId} and id in ${sql(list)} and deleted_at is null
  `

  const aliveIds = new Set(alive.map((r) => r.id))
  return list.filter((id) => !aliveIds.has(id))
}

/**
 * Flip canvas membership for the given records.
 *
 * Writes both representations while #212 is in flight: the `on_canvas` boolean,
 * which every read still uses, and the `canvas_images` rows that replace it. The
 * rows are written unplaced -- position still lives in IndexedDB until reads
 * move -- and `canvas-membership.server.test.ts` asserts the two sets agree.
 */
export async function setImagesOnCanvas(
  ids: Array<string>,
  value: boolean,
): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return

  const { userId } = await resolveAuth()

  await sql`
    update user_images set on_canvas = ${value}
    where user_id = ${userId} and id in ${sql(list)}
  `

  const canvasId = await ensureDefaultCanvas(userId)
  if (value) {
    await addCanvasMembers(
      userId,
      canvasId,
      list.map((imageId) => ({ imageId })),
    )
  } else {
    await removeCanvasMembers(userId, canvasId, list)
  }
}

/**
 * Soft-delete (move to Trash) the given rows. Callers must already have taken
 * the images off the canvas (`on_canvas = false`) so Trash's linked-image
 * protection doesn't apply. Only affects rows not already trashed.
 */
export async function trashCanvasImages(ids: Array<string>): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return

  const { userId } = await resolveAuth()

  await sql`
    update user_images set deleted_at = now()
    where user_id = ${userId} and id in ${sql(list)} and deleted_at is null
  `
}

/** Undo a `trashCanvasImages`: clear `deleted_at` and re-mark the rows on-canvas. */
export async function restoreCanvasImages(ids: Array<string>): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return

  const { userId } = await resolveAuth()

  await sql`
    update user_images set deleted_at = null, on_canvas = true
    where user_id = ${userId} and id in ${sql(list)}
  `

  const canvasId = await ensureDefaultCanvas(userId)
  await addCanvasMembers(
    userId,
    canvasId,
    list.map((imageId) => ({ imageId })),
  )
}

export interface CanvasGenerationRecord extends CanvasDbRecord {
  generation_error: string | null
}

/** One in-flight generation's row, for the canvas's completion poll. */
export async function getCanvasGenerationRecord(
  id: string,
): Promise<CanvasGenerationRecord | null> {
  const { userId } = await resolveAuth()

  const row = first(
    await sql<Array<CanvasGenerationRecord>>`
    select id, status, storage_path, generation_metadata, generation_error
    from user_images
    where user_id = ${userId} and id = ${id}
  `,
  )

  return row ?? null
}

/** The prompt an image was generated with, for pre-filling a re-generate. */
export async function getImagePrompt(id: string): Promise<string | null> {
  const { userId } = await resolveAuth()

  const row = first(
    await sql<Array<{ generation_metadata: Record<string, unknown> | null }>>`
    select generation_metadata from user_images
    where user_id = ${userId} and id = ${id}
  `,
  )

  const meta = row?.generation_metadata
  return typeof meta?.prompt === 'string' ? meta.prompt : null
}
