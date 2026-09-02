'use server'

import crypto from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveAuth } from '#/lib/server/auth.server'
import { jsonb, sql } from '#/lib/server/db.server'
import { stitchTimeline } from '#/lib/server/stitch-timeline.server'
import { extractVideoPoster } from '#/lib/server/video-poster.server'
import { createImageStorage } from '#/lib/image-storage'

/**
 * Cut the timeline and put the result in the library (#515).
 *
 * The export is a real encode, and what it produces is an ordinary clip row --
 * it lands on the Video wall, plays in the picker, can be continued from, and
 * can be dropped back onto a timeline. An editor whose output is a special kind
 * of thing you can only download is an editor you use once.
 *
 * **The bytes never reach the browser.** Clips live in a private bucket the
 * server already reads (#226), so a timeline of five 25MB clips is five
 * `storage.download()` calls beside the ffmpeg that cuts them, rather than
 * 125MB pulled into a tab to be re-encoded there. That is the whole reason
 * this is a server action and not the ffmpeg.wasm the issue was written
 * around: #499 landed real ffmpeg the day after #515 was filed.
 */

/** What the user kept of one clip, in the order it appears on the track. */
export interface TimelineClip {
  clipId: string
  inSeconds: number
  outSeconds: number
}

export interface ExportTimelineResult {
  id: string
  title: string
  durationSeconds: number
}

/** Above this the export stops being a lab experiment and wants a queue. */
const MAX_CLIPS = 12

export async function exportTimeline({
  clips,
  transitionSeconds,
  title,
}: {
  clips: Array<TimelineClip>
  transitionSeconds: number
  title: string
}): Promise<ExportTimelineResult> {
  const { userId } = await resolveAuth()

  if (clips.length === 0)
    throw new Error('There is nothing on the timeline to export')
  if (clips.length > MAX_CLIPS) {
    throw new Error(`A timeline is limited to ${MAX_CLIPS} clips for now`)
  }

  const ids = clips.map((c) => c.clipId)
  const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path
    from user_images
    where user_id = ${userId}
      and id in ${sql(ids)}
      and source = 'ai_video'
      and deleted_at is null
  `

  // Resolved by id from the user's own rows, so a forged clipId is a missing
  // clip rather than someone else's file. The order comes from the request --
  // the track's order is the user's, not the database's.
  const byId = new Map(rows.map((r) => [r.id, r.storage_path]))
  const missing = ids.filter((id) => !byId.get(id))
  if (missing.length > 0) {
    throw new Error('A clip on the timeline is no longer in your library')
  }

  const storage = createImageStorage()
  let dir: string | null = null

  try {
    dir = await mkdtemp(join(tmpdir(), 'genzen-export-'))

    const segments = []
    for (const [index, clip] of clips.entries()) {
      const blob = await storage.download(byId.get(clip.clipId)!)
      const file = join(dir, `source-${index}.mp4`)
      await writeBlob(file, blob)
      segments.push({
        file,
        inSeconds: clip.inSeconds,
        outSeconds: clip.outSeconds,
      })
    }

    const outFile = join(dir, 'export.mp4')
    const cut = await stitchTimeline(segments, outFile, transitionSeconds)

    const bytes = new Uint8Array(await readFile(outFile))
    const fileName = `ai_${Date.now()}_${crypto.randomUUID()}.mp4`
    const storagePath = `${userId}/${fileName}`
    await storage.upload(storagePath, bytes, { contentType: 'video/mp4' })

    // The same poster pass every generated clip gets, so an export is not the
    // one clip in the library with a broken tile.
    const poster = await extractVideoPoster(userId, storagePath, bytes)

    const [row] = await sql<Array<{ id: string }>>`
      insert into user_images (
        user_id, title, description, source, origin, status,
        storage_path, file_name, file_size, file_hash, mime_type,
        thumbnail_path, end_frame_path, width, height, generation_metadata
      ) values (
        ${userId},
        ${title.trim().slice(0, 200) || 'Edit'},
        ${describe(clips.length, cut.durationSeconds, transitionSeconds)},
        'ai_video',
        'images',
        'completed',
        ${storagePath},
        ${fileName},
        ${bytes.length},
        ${crypto.createHash('sha256').update(bytes).digest('hex')},
        'video/mp4',
        ${poster?.thumbnailPath ?? null},
        ${poster?.endFramePath ?? null},
        ${poster?.width ?? cut.width},
        ${poster?.height ?? cut.height},
        ${jsonb({
          // No cost: nothing was generated. Recording a zero rather than
          // leaving it absent would put an export in the spend figures as a
          // free generation, which is a different claim from "not a
          // generation at all".
          edit_source: 'lab/editor',
          duration_seconds: cut.durationSeconds,
          transition_seconds: transitionSeconds,
          timeline: clips,
        })}
      )
      returning id
    `

    return {
      id: row.id,
      title: title.trim() || 'Edit',
      durationSeconds: cut.durationSeconds,
    }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true })
  }
}

async function writeBlob(file: string, blob: Blob): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(file, new Uint8Array(await blob.arrayBuffer()))
}

function describe(count: number, duration: number, transition: number): string {
  const cuts = count === 1 ? '1 clip' : `${count} clips`
  const join = transition > 0 ? `${transition}s crossfade` : 'hard cuts'
  return `${cuts}, ${duration.toFixed(1)}s, ${join}`
}
