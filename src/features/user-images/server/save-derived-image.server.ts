import { randomUUID } from 'node:crypto'
import { createImageStorage } from '#/lib/image-storage'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { generateThumbnailInBackground } from '#/lib/server/generate-thumbnail.server'

/** Trusted server transforms use the library's bucket/row/thumbnail lifecycle.
 * The caller has already resolved identity and verified the source image. */
export async function saveDerivedImage(input: {
  userId: string
  buffer: Buffer
  title: string
  width: number
  height: number
  groupId: string
  position: number
  idempotencyKey: string
  metadata: Record<string, unknown>
  fingerprint: string
}) {
  const existing = first(
    await sql<Array<{ id: string; fingerprint: string }>>`
    select id, generation_metadata->>'extraction_fingerprint' as fingerprint
    from user_images where user_id = ${input.userId} and idempotency_key = ${input.idempotencyKey}
  `,
  )
  if (existing) {
    if (existing.fingerprint !== input.fingerprint)
      throw new Error(
        'This extraction was already saved with different boundaries. Start a new extraction.',
      )
    return existing.id
  }
  const storage = createImageStorage()
  const path = `${input.userId}/${randomUUID()}_frame.png`
  await storage.upload(path, input.buffer, { contentType: 'image/png' })
  try {
    const inserted = first(
      await sql<Array<{ id: string }>>`
      insert into user_images (user_id, title, storage_path, file_name, file_size, mime_type,
        width, height, source, origin, status, group_id, group_position, idempotency_key, generation_metadata)
      values (${input.userId}, ${input.title}, ${path}, 'frame.png', ${input.buffer.length}, 'image/png',
        ${input.width}, ${input.height}, 'upload', 'upload', 'completed', ${input.groupId},
        ${input.position}, ${input.idempotencyKey}, ${jsonb({ ...input.metadata, extraction_fingerprint: input.fingerprint })})
      on conflict (idempotency_key) where idempotency_key is not null do nothing returning id
    `,
    )
    if (inserted) {
      generateThumbnailInBackground(input.userId, path, inserted.id)
      return inserted.id
    }
    // A simultaneous retry won. Keep its record and remove only our unused object.
    await storage.remove([path]).catch(() => {})
    const winner = first(
      await sql<Array<{ id: string; fingerprint: string }>>`
      select id, generation_metadata->>'extraction_fingerprint' as fingerprint from user_images
      where user_id = ${input.userId} and idempotency_key = ${input.idempotencyKey}
    `,
    )
    if (!winner || winner.fingerprint !== input.fingerprint)
      throw new Error('Conflicting extraction request. Start a new extraction.')
    return winner.id
  } catch (error) {
    await storage.remove([path]).catch(() => {})
    throw error
  }
}
