import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  boardImageIds,
  boardSceneSchema,
  chatTurnSchema,
  emptyChat,
  emptyRun,
  idSchema,
  nameSchema,
  parseBoard,
  parseChat,
  parseRefs,
  parseRun,
} from './types'
import type {
  BoardScene,
  ChatTurn,
  RefKind,
  Session,
  SessionKind,
  SessionSummary,
} from './types'
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
    select id, name, revision, cut, chat, refs, board, to_json(updated_at)#>>'{}' as updated_at
    from director_sessions where id = ${id} and user_id = ${owner}
  `,
  )
  return row
    ? {
        ...row,
        cut: parseRun(row.cut),
        chat: parseChat(row.chat),
        refs: parseRefs(row.refs),
        board: parseBoard(row.board),
      }
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
  /** The session's seed, pinned on the first turn. */
  seed?: number,
): Promise<Session> {
  const session = await requireSession(owner, id)
  if (!session.chat) throw new Error('This session is not a chat.')
  const parsed = chatTurnSchema.parse(turn)
  const first = session.chat.character === null
  const chat = {
    ...session.chat,
    character: session.chat.character ?? character,
    ...(first && steer?.trim() ? { steer: steer.trim().slice(0, 1000) } : {}),
    ...(session.chat.seed === undefined && seed !== undefined ? { seed } : {}),
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
 * Take one burst out of a chat (#688): out of the run, out of its turn, and
 * into Trash. The turn keeps its line -- the transcript is what was said,
 * and a burst you cut because it came out garbled does not unsay it. One
 * write against both columns, like `appendChatTurn`.
 */
export async function removeChatClip(
  owner: string,
  id: string,
  clipId: string,
): Promise<Session> {
  const session = await requireSession(owner, id)
  if (!session.chat) throw new Error('This session is not a chat.')
  idSchema.parse(clipId)
  const chat = {
    ...session.chat,
    turns: session.chat.turns.map((turn) => ({
      ...turn,
      clipIds: turn.clipIds.filter((c) => c !== clipId),
    })),
  }
  const cut = {
    version: 2 as const,
    clipIds: session.cut.clipIds.filter((c) => c !== clipId),
  }
  await sql`
    update director_sessions
    set chat = ${jsonb(chat)}, cut = ${jsonb(cut)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  await trashSessionClips(owner, [clipId])
  return requireSession(owner, id)
}

/**
 * Swap one burst for its re-roll (#688): the new id takes the old one's place
 * in the run and in its turn, and the old row goes to Trash.
 */
export async function replaceChatClip(
  owner: string,
  id: string,
  oldId: string,
  newId: string,
): Promise<Session> {
  const session = await requireSession(owner, id)
  if (!session.chat) throw new Error('This session is not a chat.')
  idSchema.parse(oldId)
  idSchema.parse(newId)
  const swap = (c: string) => (c === oldId ? newId : c)
  const chat = {
    ...session.chat,
    turns: session.chat.turns.map((turn) => ({
      ...turn,
      clipIds: turn.clipIds.map(swap),
    })),
  }
  const cut = { version: 2 as const, clipIds: session.cut.clipIds.map(swap) }
  await sql`
    update director_sessions
    set chat = ${jsonb(chat)}, cut = ${jsonb(cut)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  await trashSessionClips(owner, [oldId])
  return requireSession(owner, id)
}

/**
 * Add reference assets to a session (#690).
 *
 * Additive, always: an extraction adds its sheets to what is already on the
 * tab and a derive adds one more beside the sheet it came from. Nothing here
 * replaces, which is why the word is never "regenerate" -- the collection is
 * pruned by `removeSessionRef`, not by overwriting.
 *
 * Unchecked ids and no revision check, on `appendChatTurn`'s reasoning: these
 * are rows this server just reserved, and refusing the write would lose
 * generations FAL is already making.
 */
export async function addSessionRefs(
  owner: string,
  id: string,
  add: { characters?: Array<string>; locations?: Array<string> },
  /** The stills the extraction cut, so they are trashed with the session.
   *  Deduplicated: a second extraction reuses the frames the first one cut. */
  frames: Array<string> = [],
): Promise<Session> {
  const session = await requireSession(owner, id)
  const merge = (current: Array<string>, added: Array<string> = []) => [
    ...current,
    ...added.map((assetId) => idSchema.parse(assetId)),
  ]
  const refs = {
    version: 1 as const,
    characters: merge(session.refs.characters, add.characters),
    locations: merge(session.refs.locations, add.locations),
    frames: [...new Set(merge(session.refs.frames, frames))],
  }
  await sql`
    update director_sessions
    set refs = ${jsonb(refs)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  return requireSession(owner, id)
}

/**
 * Take one sheet off a tab and trash it (#690).
 *
 * Delete is the whole of pruning: extract and derive only add, so getting the
 * collection down to what is useful is this. The frames are not touched --
 * they are on no tab and are what a later extraction reuses.
 */
export async function removeSessionRef(
  owner: string,
  id: string,
  assetId: string,
): Promise<Session> {
  const session = await requireSession(owner, id)
  idSchema.parse(assetId)
  const refs = {
    ...session.refs,
    characters: session.refs.characters.filter((a) => a !== assetId),
    locations: session.refs.locations.filter((a) => a !== assetId),
  }
  await sql`
    update director_sessions
    set refs = ${jsonb(refs)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  await trashSessionClips(owner, [assetId])
  return requireSession(owner, id)
}

/** Which tab an asset is on, or null when the session does not hold it. A
 *  derive lands beside the sheet it came from, so this is how it knows. */
export function refKindOf(session: Session, assetId: string): RefKind | null {
  if (session.refs.characters.includes(assetId)) return 'characters'
  if (session.refs.locations.includes(assetId)) return 'locations'
  return null
}

/**
 * Trash rows a session made (#679): its clips, and since #690 its reference
 * sheets and the stills they were cut from.
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

/** A Director-born asset lives and dies with its session (#679, #690):
 *  deleting the session trashes every clip it made, every reference sheet
 *  extracted or derived on it, and the stills those came from. Trash can still
 *  restore any of them. */
export async function deleteSession(owner: string, id: string) {
  const session = await getSession(owner, id)
  if (!session) return
  await trashSessionClips(owner, [
    ...session.cut.clipIds,
    ...session.refs.characters,
    ...session.refs.locations,
    ...session.refs.frames,
    ...boardImageIds(session.board),
  ])
  await sql`delete from director_sessions where id = ${id} and user_id = ${owner}`
}

/**
 * Write a session's storyboard (#695).
 *
 * Whole-column, because Create storyboard plans every scene in one call and a
 * half-written board is a story with a hole in it. Unchecked revision, on
 * `appendChatTurn`'s reasoning: the frames are generations this server has
 * already reserved and paid for.
 */
export async function saveBoard(
  owner: string,
  id: string,
  scenes: Array<BoardScene>,
  /** The board's own settings, kept as they are unless named (#702): the model
   *  sections are generated with, and the seed pinned for them. */
  settings: { model?: string; seed?: number } = {},
): Promise<Session> {
  const session = await requireSession(owner, id)
  const seed = settings.seed ?? session.board.seed
  const board = {
    version: 1 as const,
    scenes: scenes.map((scene) => boardSceneSchema.parse(scene)),
    model: settings.model ?? session.board.model,
    /* Compared against undefined rather than tested for truth: zero is a valid
       seed under the schema, and `randomInt(0, 2 ** 31)` returns it one time in
       two billion. Dropping it would mean the board never pins a seed at all,
       which is the same-noise-across-sections behaviour a seed is stored for. */
    ...(seed === undefined ? {} : { seed }),
  }
  await sql`
    update director_sessions
    set board = ${jsonb(board)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  return requireSession(owner, id)
}

/**
 * Change one scene, leaving the rest of the board where it is.
 *
 * Read-modify-write on one column, as every other writer here is: a scene is
 * closed by the drain and re-run by hand, and both only ever touch their own
 * row. `trash` is what the change replaced -- a re-run's old pair -- and goes
 * to Trash in the same call, so a board never points at a row nothing will
 * restore.
 */
export async function updateBoardScene(
  owner: string,
  id: string,
  sceneId: string,
  change: Partial<Omit<BoardScene, 'id' | 'number'>>,
  trash: Array<string> = [],
): Promise<Session> {
  const session = await requireSession(owner, id)
  idSchema.parse(sceneId)
  if (!session.board.scenes.some((scene) => scene.id === sceneId))
    throw new Error('That scene is not in this session.')
  const scenes = session.board.scenes.map((scene) =>
    scene.id === sceneId
      ? boardSceneSchema.parse({ ...scene, ...change })
      : scene,
  )
  await sql`
    update director_sessions
    set board = ${jsonb({ ...session.board, version: 1 as const, scenes })},
      revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  if (trash.length > 0) await trashSessionClips(owner, trash)
  return requireSession(owner, id)
}

/**
 * Change one field on many scenes, against the board as it is now (#703).
 *
 * **Read-modify-write inside the call, not around it.** `saveBoard` takes a
 * whole scenes array, which is right for `createStoryboard` -- that replaces
 * the board anyway -- and wrong for a pass meant to leave everything else
 * alone. `pronounceBoard` read the scenes, awaited a Claude call for several
 * seconds, and wrote its snapshot back; the drain writes `closingId`s
 * unattended during exactly that window, and every one landed in the discarded
 * copy. Worse than losing the edit: the dropped id leaves `boardImageIds`, so
 * the generation it named is never drawn *and* never trashed with the session.
 *
 * So the board is re-read here, at the moment of writing, and only the named
 * field of the named scenes is touched. A scene that vanished meanwhile is
 * skipped rather than resurrected.
 */
export async function patchBoardScenes(
  owner: string,
  id: string,
  changes: Map<string, Partial<Omit<BoardScene, 'id' | 'number'>>>,
): Promise<Session> {
  const session = await requireSession(owner, id)
  if (changes.size === 0) return session
  const scenes = session.board.scenes.map((scene) => {
    const change = changes.get(scene.id)
    return change ? boardSceneSchema.parse({ ...scene, ...change }) : scene
  })
  await sql`
    update director_sessions
    set board = ${jsonb({ ...session.board, version: 1 as const, scenes })},
      revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner}
  `
  return requireSession(owner, id)
}
