'use server'

import type { CanvasGroup, Transform } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, jsonb, sql } from '#/lib/server/db.server'
import {
  addCanvasMembers,
  ensureDefaultCanvas,
  removeCanvasMembers,
} from '#/lib/server/canvas-membership.server'
import { imageUrl } from '#/lib/image-url'

// The canvas's database access, user-scoped by `resolveAuth()`. Membership and
// trash used to be id-only queries from the browser, so an id from anywhere
// flipped or trashed a row (#173).
//
// Since #212 a canvas is a container: `canvases` holds the viewport and the
// groupings, `canvas_images` holds membership *and position*. Two consequences
// worth knowing before changing anything here:
//
//   * Membership changes go through `addImagesToCanvas` / `removeImagesFromCanvas`
//     only. `saveCanvasState` updates positions and never adds or deletes a
//     member -- a stale client must not be able to evict a generation whose
//     membership row was written server-side while it was away.
//   * There is no reconcile and nothing to prune. A membership row cannot
//     outlive its image (`on delete cascade`) and cannot be duplicated
//     (`unique (canvas_id, image_id)`).

/** One member of a canvas: the image, and where it sits. */
export interface CanvasMemberRecord {
  image_id: string
  storage_path: string | null
  status: string | null
  generation_error: string | null
  generation_metadata: Record<string, unknown> | null
  /** The public URL, resolved server-side so the first paint has the image. */
  url: string | null
  /** NULL together means unplaced -- the client lays it out on load. */
  x: number | null
  y: number | null
  width: number | null
  height: number | null
}

export interface CanvasState {
  canvasId: string
  /** NULL for a canvas nobody has panned yet; the client supplies its default. */
  transform: Transform | null
  groups: Array<CanvasGroup>
  images: Array<CanvasMemberRecord>
}

/**
 * The whole canvas, in one query pair. Read on the server by `page.tsx` and
 * handed to the view as its initial state, so there is no loading gate and no
 * empty first paint.
 *
 * Creates the canvas row on first call. That is a write on a read path, which is
 * worth it to keep every later call trivial: it happens once per account, and
 * concurrent first loads converge because `ensureDefaultCanvas` reads oldest-first.
 */
export async function loadCanvasState(): Promise<CanvasState> {
  const { userId } = await resolveAuth()
  const canvasId = await ensureDefaultCanvas(userId)

  const canvas = first(
    await sql<
      Array<{ transform: Transform | null; groups: Array<CanvasGroup> | null }>
    >`
      select transform, groups from canvases
      where id = ${canvasId} and user_id = ${userId}
    `,
  )

  const rows = await sql<Array<Omit<CanvasMemberRecord, 'url'>>>`
    select
      ci.image_id, ci.x, ci.y, ci.width, ci.height,
      ui.storage_path, ui.status, ui.generation_error, ui.generation_metadata
    from canvas_images ci
    join user_images ui on ui.id = ci.image_id
    where ci.user_id = ${userId}
      and ci.canvas_id = ${canvasId}
      and ui.deleted_at is null
    order by ci.created_at
  `

  // A trashed image is filtered above rather than removed, which is the whole
  // point of #212's trash decision: the membership row survives, so restoring
  // the image brings the card back exactly where it was.
  const images = rows.map((row) => ({
    ...row,
    url: row.storage_path ? imageUrl(row.image_id) : null,
  }))

  return {
    canvasId,
    transform: canvas?.transform ?? null,
    groups: canvas?.groups ?? [],
    images,
  }
}

export interface CanvasPosition {
  imageId: string
  x: number
  y: number
  width: number
  height: number
}

export interface SaveCanvasStateInput {
  canvasId: string
  transform: Transform
  groups: Array<CanvasGroup>
  positions: Array<CanvasPosition>
}

/**
 * Persist the arrangement: viewport, groupings, and every member's position.
 *
 * Deliberately not a membership write. The set of images on a canvas is changed
 * only by an explicit add or remove, so this cannot delete a member the client
 * has not heard about yet -- which is what the old diff-based `syncCanvasFlags`
 * could do to a generation that landed while the tab was in the background.
 */
export async function saveCanvasState({
  canvasId,
  transform,
  groups,
  positions,
}: SaveCanvasStateInput): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update canvases
    set transform = ${jsonb(transform)}, groups = ${jsonb(groups)}
    where id = ${canvasId} and user_id = ${userId}
  `

  if (positions.length === 0) return

  // One statement for every position: a per-row update turns a 200-image canvas
  // into 200 round trips on every debounce tick.
  await sql`
    update canvas_images ci
    set x = v.x, y = v.y, width = v.w, height = v.h
    from unnest(
      ${positions.map((p) => p.imageId)}::uuid[],
      ${positions.map((p) => p.x)}::float8[],
      ${positions.map((p) => p.y)}::float8[],
      ${positions.map((p) => p.width)}::float8[],
      ${positions.map((p) => p.height)}::float8[]
    ) as v(image_id, x, y, w, h)
    where ci.canvas_id = ${canvasId}
      and ci.user_id = ${userId}
      and ci.image_id = v.image_id
  `
}

/**
 * Add library images to the canvas, optionally already placed. Idempotent: an
 * image already on the canvas keeps its position rather than gaining a duplicate.
 */
export async function addImagesToCanvas(
  canvasId: string,
  members: Array<
    { imageId: string } & Partial<Omit<CanvasPosition, 'imageId'>>
  >,
): Promise<void> {
  const { userId } = await resolveAuth()
  await addCanvasMembers(userId, canvasId, members)
}

/** Take images off the canvas. The `user_images` rows are untouched. */
export async function removeImagesFromCanvas(
  canvasId: string,
  imageIds: Array<string>,
): Promise<void> {
  const { userId } = await resolveAuth()
  await removeCanvasMembers(userId, canvasId, imageIds)
}

export interface CanvasGenerationRecord {
  id: string
  storage_path: string | null
  status: string | null
  generation_metadata: Record<string, unknown> | null
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
