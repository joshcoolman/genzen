import 'server-only'
import { randomUUID } from 'node:crypto'
import { requireSession } from './sessions.server'
import { first, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/image-storage'

export async function findMedia(owner: string, id: string) {
  return first(
    await sql<
      Array<{
        id: string
        session_id: string
        storage_path: string
        mime_type: string
        size: number
      }>
    >`
    select id, session_id, storage_path, mime_type, size from director_media
    where id = ${id} and user_id = ${owner}
  `,
  )
}
export async function storeMedia(owner: string, sessionId: string, blob: Blob) {
  const id = randomUUID()
  await requireSession(owner, sessionId)
  const key = `${owner}/director/${sessionId}/${id}`
  const storage = createImageStorage()
  try {
    await sql.begin(async (tx) => {
      const session = first(
        await tx`select id from director_sessions
        where id = ${sessionId} and user_id = ${owner} for key share`,
      )
      if (!session) throw new Error('Session not found.')
      await storage.upload(key, blob, { contentType: blob.type })
      await tx`insert into director_media (id, session_id, user_id, storage_path, mime_type, size)
        values (${id}, ${sessionId}, ${owner}, ${key}, ${blob.type}, ${blob.size})`
    })
  } catch (error) {
    await storage.remove([key])
    throw error
  }
  return id
}
export async function removeMedia(owner: string, ids: Array<string>) {
  if (!ids.length) return
  const rows = await sql<
    Array<{ storage_path: string }>
  >`select storage_path from director_media
    where user_id = ${owner} and id in ${sql(ids)}`
  await createImageStorage().remove(rows.map((row) => row.storage_path))
  await sql`delete from director_media where user_id = ${owner} and id in ${sql(ids)}`
}
export async function readMedia(owner: string, id: string) {
  const media = await findMedia(owner, id)
  if (!media) throw new Error('Media not found.')
  return createImageStorage().download(media.storage_path)
}
