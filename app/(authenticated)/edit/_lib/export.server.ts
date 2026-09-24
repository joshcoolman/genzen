import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requireEdit } from './edits.server'
import { createImageStorage } from '#/lib/image-storage'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { stitchTimeline } from '#/lib/server/stitch-timeline.server'
import { extractVideoPoster } from '#/lib/server/video-poster.server'

/**
 * Cut an edit into one mp4 on the Video wall (#726).
 *
 * `stitchTimeline` survived the old Director's removal unused, and it is
 * exactly this: per-clip in and out, one canvas, one encode, a hard cut at
 * every join. The sources are downloaded from the bucket to a temp folder
 * because ffmpeg has to seek them, and the result goes back as an ordinary
 * `user_images` video row -- `origin = 'edit'` says where it came from, and
 * the wall, Trash and Activity's cost record treat it like any other clip. No
 * Activity entry: nothing was generated and nothing was paid for.
 */
export async function exportEdit(
  owner: string,
  id: string,
): Promise<{ videoId: string }> {
  const edit = await requireEdit(owner, id)
  if (edit.cut.clips.length === 0) {
    throw new Error('There is nothing in this edit to export.')
  }

  const ids = [...new Set(edit.cut.clips.map((clip) => clip.id))]
  const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path from user_images
    where id in ${sql(ids)} and user_id = ${owner}
      and status = 'completed' and deleted_at is null
  `
  const pathOf = new Map(rows.map((row) => [row.id, row.storage_path]))
  for (const clip of edit.cut.clips) {
    if (!pathOf.get(clip.id)) {
      throw new Error(
        'A clip in this edit is missing. Reload and check the cut.',
      )
    }
  }

  const storage = createImageStorage()
  const dir = await mkdtemp(join(tmpdir(), 'genzen-edit-'))
  try {
    // Each source once, however many times the cut uses it.
    const files = new Map<string, string>()
    for (const clipId of ids) {
      const file = join(dir, `${clipId}.mp4`)
      const blob = await storage.download(pathOf.get(clipId)!)
      await writeFile(file, Buffer.from(await blob.arrayBuffer()))
      files.set(clipId, file)
    }

    const out = join(dir, 'export.mp4')
    const result = await stitchTimeline(
      edit.cut.clips.map((clip) => ({
        file: files.get(clip.id)!,
        inSeconds: clip.in,
        outSeconds: clip.out,
      })),
      out,
      0,
    )

    const bytes = await readFile(out)
    const safeName = edit.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
    const storagePath = `${owner}/${Date.now()}_${randomUUID()}_${safeName}.mp4`
    await storage.upload(storagePath, bytes, { contentType: 'video/mp4' })
    const poster = await extractVideoPoster(owner, storagePath, bytes)

    const row = {
      user_id: owner,
      title: edit.name,
      status: 'completed',
      source: 'ai_video',
      origin: 'edit',
      storage_path: storagePath,
      thumbnail_path: poster?.thumbnailPath ?? null,
      end_frame_path: poster?.endFramePath ?? null,
      width: poster?.width ?? result.width,
      height: poster?.height ?? result.height,
      file_name: `${safeName}.mp4`,
      file_size: bytes.byteLength,
      mime_type: 'video/mp4',
      sort_order: Date.now() / 1000,
      generation_metadata: jsonb({
        model_label: 'Edit',
        duration_seconds: result.durationSeconds,
        edit_id: edit.id,
        clips: edit.cut.clips,
        completed_at: new Date().toISOString(),
      }),
    }
    try {
      const record = first(
        // sql-scope-exempt: an insert scopes by what it writes, and `row`
        // carries user_id from resolveAuth().
        await sql<Array<{ id: string }>>`
          insert into user_images ${sql(row)} returning id
        `,
      )
      if (!record) throw new Error('The export could not be recorded.')
      return { videoId: record.id }
    } catch (cause) {
      await storage
        .remove(poster ? [storagePath, poster.thumbnailPath] : [storagePath])
        .catch(() => {})
      throw cause
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
