'use server'

import { resolveAuth } from '@/lib/server/auth.server'

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
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, storage_path, status, generation_metadata')
    .eq('user_id', userId)
    .eq('on_canvas', true)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return data as unknown as Array<CanvasDbRecord>
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

  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, deleted_at')
    .eq('user_id', userId)
    .in('id', list)

  if (error) throw new Error(error.message)

  const alive = new Set(data.filter((r) => !r.deleted_at).map((r) => r.id))
  return list.filter((id) => !alive.has(id))
}

/** Flip canvas membership for the given records. */
export async function setImagesOnCanvas(
  ids: Array<string>,
  value: boolean,
): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return

  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ on_canvas: value })
    .eq('user_id', userId)
    .in('id', list)

  if (error) throw new Error(error.message)
}

/**
 * Soft-delete (move to Trash) the given rows. Callers must already have taken
 * the images off the canvas (`on_canvas = false`) so Trash's linked-image
 * protection doesn't apply. Only affects rows not already trashed.
 */
export async function trashCanvasImages(ids: Array<string>): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return

  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', list)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}

/** Undo a `trashCanvasImages`: clear `deleted_at` and re-mark the rows on-canvas. */
export async function restoreCanvasImages(ids: Array<string>): Promise<void> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return

  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ deleted_at: null, on_canvas: true })
    .eq('user_id', userId)
    .in('id', list)

  if (error) throw new Error(error.message)
}

export interface CanvasGenerationRecord extends CanvasDbRecord {
  generation_error: string | null
}

/** One in-flight generation's row, for the canvas's completion poll. */
export async function getCanvasGenerationRecord(
  id: string,
): Promise<CanvasGenerationRecord | null> {
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, status, storage_path, generation_metadata, generation_error')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as unknown as CanvasGenerationRecord | null
}

/** The prompt an image was generated with, for pre-filling a re-generate. */
export async function getImagePrompt(id: string): Promise<string | null> {
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const meta = data?.generation_metadata as Record<string, unknown> | null
  return typeof meta?.prompt === 'string' ? meta.prompt : null
}
