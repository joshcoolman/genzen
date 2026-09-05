import 'server-only'
import { cutMediaIds, exportInputSchema, nameSchema } from './types'
import { requireSession } from './sessions.server'
import { removeMedia } from './media.server'
import type { ExportInput, SavedExport, StoredCut } from './types'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/image-storage'

type Output = {
  mediaId: string
  thumbnailId: string
  endFrameId: string
  duration: number
}
export async function getExport(owner: string, sessionId: string, id: string) {
  return (
    first(
      await sql<
        Array<SavedExport>
      >`select id, session_id, name, media_id, thumbnail_id, end_frame_id, duration, source,
    to_json(created_at)#>>'{}' as created_at from director_exports
    where user_id = ${owner} and session_id = ${sessionId} and id = ${id}`,
    ) ?? null
  )
}
export async function listExports(owner: string, sessionId: string) {
  await requireSession(owner, sessionId)
  return sql<
    Array<SavedExport>
  >`select id, session_id, name, media_id, thumbnail_id, end_frame_id, duration, source,
    to_json(created_at)#>>'{}' as created_at from director_exports
    where user_id = ${owner} and session_id = ${sessionId} order by created_at desc`
}
export async function prepareExport(
  owner: string,
  sessionId: string,
  input: unknown,
) {
  const data = exportInputSchema.parse(input)
  await requireSession(owner, sessionId)
  const ids = [
    ...new Set(
      data.source.flatMap((clip) => [
        clip.mediaId,
        clip.endFrameId,
        clip.thumbnailId,
      ]),
    ),
  ]
  const media =
    await sql`select id from director_media where user_id = ${owner} and session_id = ${sessionId} and id in ${sql(ids)}`
  if (media.length !== ids.length)
    throw new Error('Export source media is missing.')
  return data
}
export async function saveExport(
  owner: string,
  sessionId: string,
  input: ExportInput,
  output: Output,
) {
  // Serialize publication with session deletion and concurrent retries. A retry
  // may upload new bytes, but can never replace the first saved export.
  try {
    await sql.begin(async (tx) => {
      const session = first(
        await tx`select id from director_sessions where user_id = ${owner} and id = ${sessionId} for update`,
      )
      if (!session) throw new Error('Session not found.')
      await tx`insert into director_exports (id, session_id, user_id, name, media_id, thumbnail_id, end_frame_id, duration, source)
        values (${input.id}, ${sessionId}, ${owner}, ${input.name}, ${output.mediaId}, ${output.thumbnailId}, ${output.endFrameId}, ${output.duration}, ${jsonb(input.source)})
        on conflict (id) do nothing`
    })
  } catch (error) {
    // Resolve an ambiguous commit before removing anything the record may own.
    const saved = await getExport(owner, sessionId, input.id)
    if (!saved || saved.media_id !== output.mediaId)
      await removeMedia(owner, [
        output.mediaId,
        output.thumbnailId,
        output.endFrameId,
      ])
    if (saved) return saved
    throw error
  }
  const saved = await getExport(owner, sessionId, input.id)
  if (!saved || saved.media_id !== output.mediaId)
    await removeMedia(owner, [
      output.mediaId,
      output.thumbnailId,
      output.endFrameId,
    ])
  if (!saved) throw new Error('Export could not be saved.')
  return saved
}
export async function renameExport(
  owner: string,
  sessionId: string,
  id: string,
  name: string,
) {
  name = nameSchema.parse(name)
  const rows = await sql`update director_exports set name = ${name}
    where user_id = ${owner} and session_id = ${sessionId} and id = ${id} returning id`
  if (!rows.length) throw new Error('Export not found.')
}
export async function deleteExport(
  owner: string,
  sessionId: string,
  id: string,
) {
  await sql.begin(async (tx) => {
    const session = first(
      await tx<Array<{ cut: StoredCut }>>`select cut from director_sessions
      where user_id = ${owner} and id = ${sessionId} for update`,
    )
    if (!session) throw new Error('Session not found.')
    const item = first(
      await tx<
        Array<SavedExport>
      >`select media_id, thumbnail_id, end_frame_id from director_exports
      where user_id = ${owner} and session_id = ${sessionId} and id = ${id}`,
    )
    if (!item) return
    const ids = [item.media_id, item.thumbnail_id, item.end_frame_id]
    if (cutMediaIds(session.cut).some((mediaId) => ids.includes(mediaId)))
      throw new Error('This export is being used by the session.')
    const media = await tx<
      Array<{ storage_path: string }>
    >`select storage_path from director_media
      where user_id = ${owner} and session_id = ${sessionId} and id in ${sql(ids)}`
    await createImageStorage().remove(media.map((row) => row.storage_path))
    await tx`delete from director_exports where user_id = ${owner} and session_id = ${sessionId} and id = ${id}`
    await tx`delete from director_media where user_id = ${owner} and session_id = ${sessionId} and id in ${sql(ids)}`
  })
}
