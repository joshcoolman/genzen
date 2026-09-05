import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  cutMediaIds,
  emptyStoredCut,
  idSchema,
  nameSchema,
  storedCutSchema,
} from './types'
import type { Session, SessionSummary, StoredCut } from './types'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/image-storage'

export async function getSession(
  owner: string,
  id: string,
): Promise<Session | null> {
  if (!idSchema.safeParse(id).success) return null
  const row = first(
    await sql<Array<Session>>`
    select id, name, revision, cut, draft, to_json(updated_at)#>>'{}' as updated_at
    from director_sessions where id = ${id} and user_id = ${owner}
  `,
  )
  return row ? { ...row, cut: storedCutSchema.parse(row.cut) } : null
}
export async function requireSession(owner: string, id: string) {
  const session = await getSession(owner, id)
  if (!session) throw new Error('Session not found.')
  return session
}
export async function listSessions(
  owner: string,
): Promise<Array<SessionSummary>> {
  const rows = await sql<Array<Session & { exports: number }>>`
    select id, name, cut, to_json(updated_at)#>>'{}' as updated_at,
      (select count(*)::int from director_exports e where e.session_id = director_sessions.id and e.user_id = ${owner}) as exports
    from director_sessions where user_id = ${owner} order by updated_at desc
  `
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    count: row.cut.clips.length,
    exports: row.exports,
    thumbnails: row.cut.clips.slice(0, 6).map((clip) => clip.thumbnailId),
    pending: !!row.cut.pending,
    updated_at: row.updated_at,
  }))
}
export async function createSession(
  owner: string,
  name: string,
  id: string = randomUUID(),
) {
  idSchema.parse(id)
  name = nameSchema.parse(name)
  await sql`
    insert into director_sessions (id, user_id, name, cut)
    values (${id}, ${owner}, ${name}, ${jsonb(emptyStoredCut())})
    on conflict (id) do nothing
  `
  return requireSession(owner, id)
}
export async function renameSession(owner: string, id: string, name: string) {
  name = nameSchema.parse(name)
  await requireSession(owner, id)
  await sql`update director_sessions set name = ${name}, updated_at = now()
    where id = ${id} and user_id = ${owner}`
}
export async function saveState(
  owner: string,
  session: Session,
  cut: StoredCut,
  draft?: string,
) {
  cut = storedCutSchema.parse(cut)
  const ids = cutMediaIds(cut)
  if (ids.length) {
    const media = await sql<Array<{ id: string }>>`select id from director_media
      where user_id = ${owner} and session_id = ${session.id} and final_cut_id is null and id in ${sql(ids)}`
    if (media.length !== ids.length)
      throw new Error('Some session media has not finished saving.')
  }
  const rows = await sql`
    update director_sessions set cut = ${jsonb(cut)}, draft = ${draft === undefined ? sql`draft` : draft}, revision = revision + 1, updated_at = now()
    where id = ${session.id} and user_id = ${owner} and revision = ${session.revision}
    returning id
  `
  if (!rows.length)
    throw new Error(
      'This session changed in another tab. Reload before editing.',
    )
  return requireSession(owner, session.id)
}
export async function saveDraft(
  owner: string,
  id: string,
  draft: string,
  previous: string,
) {
  if (draft.length > 2000) throw new Error('Please shorten this direction.')
  await requireSession(owner, id)
  const rows =
    await sql`update director_sessions set draft = ${draft}, updated_at = now()
    where id = ${id} and user_id = ${owner} and draft = ${previous} returning id`
  if (!rows.length)
    throw new Error('The draft changed in another tab. Reload before editing.')
}
export async function deleteSession(owner: string, id: string) {
  // Hold the row lock through cleanup: saving/generating cannot publish into
  // a session between collecting its files and deleting it.
  await sql.begin(async (tx) => {
    const row = first(
      await tx<Array<{ cut: StoredCut }>>`select cut from director_sessions
      where id = ${id} and user_id = ${owner} for update`,
    )
    if (!row) return
    const finishing = first(
      await tx`select id from director_final_cuts where user_id = ${owner} and session_id = ${id}
      and (status in ('queued', 'running') or lease_until > now()) for update`,
    )
    if (finishing)
      throw new Error(
        'Stop the active Final Cut and wait for it to finish before deleting this session.',
      )
    if (row.cut.pending)
      throw new Error(
        'Resolve or dismiss the pending request before deleting this session.',
      )
    const media = await tx<
      Array<{ storage_path: string }>
    >`select storage_path from director_media
      where session_id = ${id} and user_id = ${owner}`
    for (let offset = 0; offset < media.length; offset += 500)
      await createImageStorage().remove(
        media.slice(offset, offset + 500).map((item) => item.storage_path),
      )
    await tx`delete from director_sessions where id = ${id} and user_id = ${owner}`
  })
}
