import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  chatTurnSchema,
  emptyChat,
  emptyRun,
  idSchema,
  nameSchema,
  parseChat,
  parseRun,
} from './types'
import type { ChatTurn, Session, SessionKind, SessionSummary } from './types'
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
    select id, name, revision, cut, chat, to_json(updated_at)#>>'{}' as updated_at
    from director_sessions where id = ${id} and user_id = ${owner}
  `,
  )
  return row
    ? { ...row, cut: parseRun(row.cut), chat: parseChat(row.chat) }
    : null
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
    select id, name, cut, chat, to_json(updated_at)#>>'{}' as updated_at
    from director_sessions where user_id = ${owner} order by updated_at desc
  `
  return rows.map((row) => {
    const run = parseRun(row.cut)
    return {
      id: row.id,
      name: row.name,
      kind: row.chat === null ? 'run' : 'chat',
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
  kind: SessionKind = 'run',
) {
  idSchema.parse(id)
  name = nameSchema.parse(name)
  // The kind is the column: a chat starts with an empty chat and a run with
  // none, and nothing later turns one into the other.
  const chat = kind === 'chat' ? jsonb(emptyChat()) : null
  await sql`
    insert into director_sessions (id, user_id, name, cut, chat)
    values (${id}, ${owner}, ${name}, ${jsonb(emptyRun())}, ${chat})
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

/**
 * Record an answered turn (#670): the character if this is the turn that
 * invented it, the turn itself, and its clips appended to the run.
 *
 * One write for both columns (and the name, on the first turn), so a turn can
 * never be in the chat without its clips being in the run or the other way
 * round. It bumps `revision` like
 * `saveRun`, but does not check it: the caller is the server answering a
 * question, not a tab holding a stale order, and refusing the write would lose
 * clips FAL is already making.
 */
export async function appendChatTurn(
  owner: string,
  id: string,
  turn: ChatTurn,
  character: string,
  /** The chat's name, written on the first turn only: a chat opens unnamed
   *  and the model titles it from the question. */
  name?: string,
  /** What the person asked for, kept with the character it produced. */
  steer?: string | null,
): Promise<Session> {
  const session = await requireSession(owner, id)
  if (!session.chat) throw new Error('This session is not a chat.')
  const parsed = chatTurnSchema.parse(turn)
  const first = session.chat.character === null
  const chat = {
    ...session.chat,
    character: session.chat.character ?? character,
    ...(first && steer?.trim() ? { steer: steer.trim().slice(0, 1000) } : {}),
    turns: [...session.chat.turns, parsed],
  }
  const cut = {
    version: 2 as const,
    clipIds: [...session.cut.clipIds, ...parsed.clipIds],
  }
  const title =
    session.chat.turns.length === 0 && name
      ? nameSchema.parse(name)
      : session.name
  await sql`
    update director_sessions
    set chat = ${jsonb(chat)}, cut = ${jsonb(cut)}, name = ${title},
      revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  return requireSession(owner, id)
}

/**
 * The characters this person has met, newest first, one line each -- the
 * first sentence of the stored description, which is what the model leads
 * with: what they are and roughly who. Handed to the next first turn as what
 * not to resemble. Capped, because the list is a nudge and not a history.
 */
export async function listCharactersMet(
  owner: string,
  except: string,
  limit = 20,
): Promise<Array<string>> {
  const rows = await sql<Array<{ character: string }>>`
    select chat->>'character' as character
    from director_sessions
    where user_id = ${owner} and id <> ${except}
      and chat->>'character' is not null
    order by updated_at desc
    limit ${limit}
  `
  return rows.map((row) => {
    const sentence = row.character.match(/^.*?[.!?](?=\s|$)/)?.[0]
    return (sentence ?? row.character).slice(0, 160)
  })
}

/**
 * Trash clips a session made (#679).
 *
 * Guarded on `origin = 'director'` rather than trusting the ids: a session
 * from before isolation may still hold a clip picked off the Video wall, and
 * that one belongs to Video. A row already trashed is left as it is.
 */
export async function trashSessionClips(owner: string, ids: Array<string>) {
  const clipIds = ids.map((clipId) => idSchema.parse(clipId))
  if (clipIds.length === 0) return
  await sql`
    update user_images set deleted_at = now(), group_id = null
    where id in ${sql(clipIds)} and user_id = ${owner}
      and origin = 'director' and deleted_at is null
  `
}

/** A Director-born clip lives and dies with its session (#679): deleting the
 *  session trashes every clip it made. Trash can still restore them. */
export async function deleteSession(owner: string, id: string) {
  const session = await getSession(owner, id)
  if (!session) return
  await trashSessionClips(owner, session.cut.clipIds)
  await sql`delete from director_sessions where id = ${id} and user_id = ${owner}`
}
