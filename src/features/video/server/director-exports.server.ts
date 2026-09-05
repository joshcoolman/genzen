import 'server-only'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/image-storage'

/** Copy an intentional export, never its working clips. Video owns these bytes
 * independently of Director; names and provenance are snapshots at publication. */
export async function publishDirectorExport(
  owner: string,
  sessionId: string,
  exportId: string,
) {
  return sql.begin(async (tx) => {
    const session = first(
      await tx<Array<{ name: string }>>`
      select name from director_sessions where user_id = ${owner} and id = ${sessionId} for update
    `,
    )
    if (!session) return null
    const published = first(
      await tx<Array<{ video_id: string }>>`
      select video_id from director_export_videos where user_id = ${owner} and export_id = ${exportId}
    `,
    )
    if (published) return published.video_id
    const item = first(
      await tx<
        Array<{
          name: string
          media_id: string
          thumbnail_id: string
          end_frame_id: string
          duration: number
          source: Array<{ prompt: string }>
          created_at: Date
        }>
      >`
      select name, media_id, thumbnail_id, end_frame_id, duration, source, created_at
      from director_exports where user_id = ${owner} and session_id = ${sessionId} and id = ${exportId}
    `,
    )
    if (!item) return null
    const media = await tx<
      Array<{ id: string; storage_path: string; size: number }>
    >`
      select id, storage_path, size from director_media where user_id = ${owner}
      and session_id = ${sessionId} and final_cut_id is null
      and id in ${sql([item.media_id, item.thumbnail_id, item.end_frame_id])}
    `
    const video = media.find((row) => row.id === item.media_id)
    const thumbnail = media.find((row) => row.id === item.thumbnail_id)
    const end = media.find((row) => row.id === item.end_frame_id)
    if (!video || !thumbnail || !end)
      throw new Error('Director export media is missing.')
    const storage = createImageStorage()
    const base = `${owner}/director-exports/${exportId}`
    const paths = [
      `${base}/video.mp4`,
      `${base}/thumb.webp`,
      `${base}/end.webp`,
    ]
    const id = randomUUID()
    // Cleanup is inside the transaction callback, before any COMMIT attempt.
    // An ambiguous COMMIT must never delete bytes the library may now own.
    try {
      const endBlob = await storage.download(end.storage_path)
      const endImage = await sharp(new Uint8Array(await endBlob.arrayBuffer()))
        .webp()
        .toBuffer({ resolveWithObject: true })
      await storage.copy(video.storage_path, paths[0])
      await storage.copy(thumbnail.storage_path, paths[1])
      await storage.upload(paths[2], endImage.data, {
        contentType: 'image/webp',
      })
      await tx`
        insert into user_images (id, user_id, title, description, source, origin, status,
          storage_path, thumbnail_path, end_frame_path, file_name, file_size, mime_type,
          width, height, generation_metadata, created_at)
        values (${id}, ${owner}, ${item.name}, ${item.source
          .map((clip) => clip.prompt)
          .join('\n')},
          'ai_video', 'director', 'completed', ${paths[0]}, ${paths[1]}, ${paths[2]},
          ${`director-${exportId}.mp4`}, ${video.size}, 'video/mp4',
          ${endImage.info.width}, ${endImage.info.height},
          ${jsonb({
            edit_source: 'director',
            duration_seconds: item.duration,
            director_source: {
              session_id: sessionId,
              session_name: session.name,
              export_id: exportId,
              export_name: item.name,
              script: item.source.map((clip) => clip.prompt),
            },
          })},
          ${item.created_at})
      `
      await tx`insert into director_export_videos (export_id, user_id, video_id) values (${exportId}, ${owner}, ${id})`
      return id
    } catch (error) {
      await storage.remove(paths)
      throw error
    }
  })
}

/** Also repairs publication interrupted after a Director save. Only missing
 * publication records are considered, including when the Video copy was deleted. */
export async function publishDirectorExports(owner: string) {
  const exports = await sql<Array<{ id: string; session_id: string }>>`
    select id, session_id from director_exports e where e.user_id = ${owner}
    and not exists (select 1 from director_export_videos v where v.user_id = ${owner} and v.export_id = e.id)
    order by created_at
  `
  for (const item of exports) {
    try {
      await publishDirectorExport(owner, item.session_id, item.id)
    } catch (error) {
      // A broken old export must not make the entire Video/Frames library
      // unavailable. No publication is recorded; the next visit retries it.
      console.error('[director-export-publication]', item.id, error)
    }
  }
}
