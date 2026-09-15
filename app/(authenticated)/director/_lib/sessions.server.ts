import 'server-only'
import { randomUUID } from 'node:crypto'
import { emptyRun, idSchema, nameSchema, parseRun } from './types'
import type { Session, SessionSummary } from './types'
import { first, jsonb, sql } from '#/lib/server/db.server'

/**
 * A session's name and its run (#662).
 *
 * Nothing here owns bytes any more. Director's private media -- its own table,
 * its own bucket objects, its own routes -- is gone, and a session's clips are
 * ordinary `user_images` rows. So a session is a row and deleting one is a
 * delete, not a cleanup.
 */
export async function getSession(
  owner: string,
  id: string,
): Promise<Session | null> {
  if (!idSchema.safeParse(id).success) return null
  const row = first(
    await sql<Array<Session>>`
    select id, name, revision, cut, to_json(updated_at)#>>'{}' as updated_at
    from director_sessions where id = ${id} and user_id = ${owner}
  `,
  )
  return row ? { ...row, cut: parseRun(row.cut) } : null
}

export async function requireSession(owner: string, id: string) {
  const session = await getSession(owner, id)
  if (!session) throw new Error('Session not found.')
  return session
}

export async function listSessions(
  owner: string,
): Promise<Array<SessionSummary>> {
  const rows = await sql<Array<Session>>`
    select id, name, cut, to_json(updated_at)#>>'{}' as updated_at
    from director_sessions where user_id = ${owner} order by updated_at desc
  `
  return rows.map((row) => {
    const run = parseRun(row.cut)
    return {
      id: row.id,
      name: row.name,
      count: run.clipIds.length,
      thumbnails: run.clipIds.slice(0, 6),
      updated_at: row.updated_at,
    }
  })
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
    values (${id}, ${owner}, ${name}, ${jsonb(emptyRun())})
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

/**
 * Write the run, if nothing else has since it was read.
 *
 * The ids are stored as given and are not checked against the library: a clip
 * generated from inside the session is in the run before its row is visible to
 * this request, and refusing it would lose the thing that was just paid for. An
 * id that resolves to nothing simply drops out when the session is next opened.
 */
export async function saveRun(
  owner: string,
  id: string,
  revision: number,
  clipIds: Array<string>,
): Promise<Session> {
  const cut = {
    version: 2 as const,
    clipIds: clipIds.map((clipId) => idSchema.parse(clipId)),
  }
  const rows = await sql`
    update director_sessions set cut = ${jsonb(cut)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner} and revision = ${revision}
    returning id
  `
  if (!rows.length) {
    await requireSession(owner, id)
    throw new Error(
      'This session changed in another tab. Reload before editing.',
    )
  }
  return requireSession(owner, id)
}

export async function deleteSession(owner: string, id: string) {
  await sql`delete from director_sessions where id = ${id} and user_id = ${owner}`
}
