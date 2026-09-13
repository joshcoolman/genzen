'use server'

import type { ClipFrame } from '#/lib/server/clip-frames.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import {
  buildClipFrameGrid,
  extractClipFrame,
} from '#/lib/server/clip-frames.server'
import { createImageStorage } from '#/lib/image-storage'

/** What the grid needs to draw itself: the sheet is fetched from
 *  `/img/[id]?v=frames`, and everything here says how to slice it. */
export interface ClipFrameGridView {
  times: Array<number>
  tileWidth: number
  tileHeight: number
}

interface ClipRow {
  storage_path: string | null
  status: string
  generation_metadata: Record<string, unknown> | null
}

async function loadClip(clipId: string, userId: string): Promise<ClipRow> {
  const row = first(
    await sql<Array<ClipRow>>`
      select storage_path, status, generation_metadata
      from user_images
      where id = ${clipId}
        and user_id = ${userId}
        and source = 'ai_video'
        and deleted_at is null
    `,
  )

  if (!row?.storage_path) throw new Error('That clip is not here any more')
  if (row.status !== 'completed') throw new Error('That clip is not finished')
  return row
}

function storedGrid(row: ClipRow): ClipFrameGridView | null {
  const grid = (row.generation_metadata ?? {}).frame_grid as
    | {
        times?: unknown
        tile_width?: unknown
        tile_height?: unknown
      }
    | undefined

  if (
    !grid ||
    !Array.isArray(grid.times) ||
    grid.times.length === 0 ||
    typeof grid.tile_width !== 'number' ||
    typeof grid.tile_height !== 'number'
  ) {
    return null
  }

  return {
    times: grid.times.filter((t): t is number => typeof t === 'number'),
    tileWidth: grid.tile_width,
    tileHeight: grid.tile_height,
  }
}

function requestedDuration(row: ClipRow): number | null {
  const seconds = (row.generation_metadata ?? {}).duration_seconds
  return typeof seconds === 'number' ? seconds : null
}

/**
 * The grid of stills for a clip, sampled on first ask and stored after (#647).
 *
 * **The sheet is built once per clip, ever.** Decoding a whole clip is seconds
 * of work, and the sheet that comes out of it does not change -- the clip is
 * immutable. So the timestamps go into `generation_metadata.frame_grid` beside
 * the sheet's bucket key, and every reopen is a cached image request and one
 * row read. That is what makes the second open feel like opening a picture
 * rather than starting a job.
 *
 * `generation_metadata` rather than a migration, for the reason
 * `stampFrameSource` gives: it is jsonb and already an open namespace, and this
 * is one fact about one row that nothing else queries.
 */
export async function clipFrameGrid({
  clipId,
}: {
  clipId: string
}): Promise<ClipFrameGridView> {
  const { userId } = await resolveAuth()
  const row = await loadClip(clipId, userId)

  const stored = storedGrid(row)
  if (stored) return stored

  const blob = await createImageStorage().download(row.storage_path!)
  const grid = await buildClipFrameGrid({
    userId,
    storagePath: row.storage_path!,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    fallbackDuration: requestedDuration(row),
  })

  if (!grid) throw new Error('No frames could be read out of that clip')

  await sql`
    update user_images
    set generation_metadata =
      coalesce(generation_metadata, '{}'::jsonb) ||
      ${sql.json({
        frame_grid: {
          times: grid.times,
          sheet_path: grid.sheetPath,
          tile_width: grid.tileWidth,
          tile_height: grid.tileHeight,
        },
      })}::jsonb
    where id = ${clipId} and user_id = ${userId}
  `

  return {
    times: grid.times,
    tileWidth: grid.tileWidth,
    tileHeight: grid.tileHeight,
  }
}

/**
 * One selected frame, at full resolution, for the browser to put in the
 * library through `saveFileToLibrary` -- the one path in (#215).
 *
 * One call per frame, run serially by the caller. A single call carrying every
 * selection would be one RSC response holding ten full-size PNGs, and the
 * import would show nothing until all of them had landed.
 */
export async function grabClipFrame({
  clipId,
  timeSeconds,
}: {
  clipId: string
  timeSeconds: number
}): Promise<ClipFrame> {
  const { userId } = await resolveAuth()
  const row = await loadClip(clipId, userId)

  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new Error('That is not a position in the clip')
  }

  const blob = await createImageStorage().download(row.storage_path!)
  return extractClipFrame({
    bytes: new Uint8Array(await blob.arrayBuffer()),
    timeSeconds,
  })
}

/**
 * The positions in this clip that have already been imported as stills.
 *
 * The grid marks those tiles and leaves them out of a selection, so pressing
 * Import twice on the same clip does not put the same picture in the library
 * twice. Provenance, not bytes, for the reasons `findClipEndFrame` sets out --
 * and `kind = 'grid'` so a scrub from `lab/frames` at a coincidentally equal
 * second is not mistaken for one of these tiles.
 *
 * Trashed rows are excluded: a frame that was thrown away should be grabbable
 * again rather than showing as already there.
 */
export async function importedClipFrameTimes({
  clipId,
}: {
  clipId: string
}): Promise<Array<number>> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ time_seconds: string | null }>>`
    select generation_metadata->'frame_source'->>'time_seconds' as time_seconds
    from user_images
    where user_id = ${userId}
      and deleted_at is null
      and generation_metadata->'frame_source'->>'clip_id' = ${clipId}
      and generation_metadata->'frame_source'->>'kind' = 'grid'
  `

  return rows
    .map((row) => Number(row.time_seconds))
    .filter((time) => Number.isFinite(time))
}
