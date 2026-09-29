import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/server/storage/client.server'
import { decodeEndFrame } from '#/lib/server/media/video-poster.server'

/** Full-resolution PNG, never the end thumbnail. Provenance makes retries reuse it. */
export async function continuityFrame(
  owner: string,
  clipId: string,
): Promise<string> {
  const existing = first(
    await sql<Array<{ id: string }>>`
    select id from user_images where user_id = ${owner} and deleted_at is null
      and status = 'completed' and source = 'ai_video_frame'
      and generation_metadata->'frame_source'->>'clip_id' = ${clipId}
      and generation_metadata->'frame_source'->>'kind' = 'end'
      and generation_metadata->>'full_resolution' = 'true'
    limit 1
  `,
  )
  if (existing) return existing.id
  const clip = first(
    await sql<Array<{ storage_path: string | null }>>`
    select storage_path from user_images where id = ${clipId} and user_id = ${owner}
      and status = 'completed' and deleted_at is null and source = 'ai_video'
  `,
  )
  if (!clip?.storage_path)
    throw new Error('The previous clip has no finished video.')
  const storage = createImageStorage()
  const bytes = await storage.download(clip.storage_path)
  const dir = await mkdtemp(join(tmpdir(), 'director-handoff-'))
  try {
    const file = join(dir, 'clip.mp4')
    await writeFile(file, Buffer.from(await bytes.arrayBuffer()))
    const frame = await decodeEndFrame(file)
    if (!frame)
      throw new Error(
        'Could not read the previous clip’s ending frame. Retry the handoff.',
      )
    const { width, height } = await sharp(frame).metadata()
    if (!width || !height)
      throw new Error('The ending frame has no dimensions.')
    const id = randomUUID()
    const path = `${owner}/${id}-continuity.png`
    await storage.upload(path, frame, { contentType: 'image/png' })
    try {
      await sql`
        insert into user_images (id, user_id, title, storage_path, file_name, mime_type,
          file_size, width, height, source, origin, status, generation_metadata)
        values (${id}, ${owner}, 'Continuity frame', ${path}, 'continuity.png', 'image/png',
          ${frame.length}, ${width}, ${height}, 'ai_video_frame', 'director', 'completed',
          ${jsonb({ full_resolution: true, frame_source: { clip_id: clipId, kind: 'end' } })})
      `
    } catch (cause) {
      await storage.remove([path])
      throw cause
    }
    return id
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
