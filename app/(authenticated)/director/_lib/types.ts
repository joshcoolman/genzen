import { z } from 'zod'

export const idSchema = z.string().uuid()
export const nameSchema = z.string().trim().min(1).max(120)

/**
 * A session is a name and an ordered list of clip ids (#662).
 *
 * **Version 2, and there is no version 1 left to read.** The first shape held a
 * whole cut -- clips with prompts, durations, private media ids, a pending
 * request, a review hold, archived exports -- and every row carrying one was
 * deleted with the rest of Director rather than migrated. `parseRun` below
 * falls back to an empty run rather than throwing, so a row that somehow
 * survived opens empty instead of 500ing the page.
 *
 * **Ids, not rows.** The clips are ordinary `user_images` rows made by
 * `generateVideo`, so everything about one -- its name, its poster, whether it
 * has finished -- is read off the library as it is now. A run holding copies
 * would show the name a clip had when it was added, and naming clips is half of
 * what a session is for.
 */
export const storedRunSchema = z.object({
  version: z.literal(2),
  clipIds: z.array(idSchema).max(200),
})
export type StoredRun = z.infer<typeof storedRunSchema>

export function emptyRun(): StoredRun {
  return { version: 2, clipIds: [] }
}

export function parseRun(value: unknown): StoredRun {
  const parsed = storedRunSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyRun()
}

/**
 * A chat session's own state (#670): the character invented on the first turn
 * and every question asked since, each with the clips that answered it.
 *
 * Beside the run, not instead of it. `cut.clipIds` still holds every clip in
 * order, so the player, the row and Script read a chat exactly as they read a
 * run; the turns only say which clips belong to which answer, which is what
 * lets the stage wait for a whole answer before playing it.
 *
 * `character` is null until the first answer lands and pinned from then on, so
 * the surprise holds across turns.
 */
export const chatTurnSchema = z.object({
  id: idSchema,
  question: z.string().trim().min(1).max(2000),
  /** The character's own words, as a transcript line. */
  line: z.string().max(4000),
  clipIds: z.array(idSchema).max(6),
  created_at: z.string(),
})
export type ChatTurn = z.infer<typeof chatTurnSchema>

export const storedChatSchema = z.object({
  version: z.literal(1),
  character: z.string().max(4000).nullable(),
  /** What the person asked for before the first question, if anything. */
  steer: z.string().max(1000).optional(),
  /** One seed for the session, chosen on the first turn and sent with every
   *  burst, so each starts from the same noise (#687). */
  seed: z.number().int().nonnegative().optional(),
  turns: z.array(chatTurnSchema).max(200),
})
export type StoredChat = z.infer<typeof storedChatSchema>

export function emptyChat(): StoredChat {
  return { version: 1, character: null, turns: [] }
}

/** Null is a run session; an unreadable value opens as an empty chat rather
 *  than 500ing the page, on the same reasoning as `parseRun`. */
export function parseChat(value: unknown): StoredChat | null {
  if (value === null || value === undefined) return null
  const parsed = storedChatSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyChat()
}

export type SessionKind = 'run' | 'chat'

export interface Session {
  id: string
  name: string
  /** Bumped by every write and checked by the next one: a second tab editing
   *  the same session is rejected rather than silently overwriting. */
  revision: number
  cut: StoredRun
  /** Null for a run session. */
  chat: StoredChat | null
  /** The reference sheets extracted from its clips (#690). */
  refs: StoredRefs
  updated_at: string
}

export interface SessionSummary {
  id: string
  name: string
  kind: SessionKind
  count: number
  /** The first few clip ids, for the card's strip. Library rows, so the card
   *  draws them through `/img/[id]?v=thumb` like anything else. */
  thumbnails: Array<string>
  updated_at: string
}

/**
 * A session's reference sheets (#690).
 *
 * Beside the run and the chat, not instead of either: a session is becoming a
 * container for more than one kind of asset, and these are the second kind.
 * `characters` and `locations` are what the two tabs draw, in the order they
 * were added; `frames` are the stills the extraction cut out of the clips to
 * have something to hand the image model, shown on no tab and kept only so
 * they are trashed with the session.
 *
 * Ids, not rows, on `StoredRun`'s reasoning. An id that resolves to nothing --
 * a sheet trashed from somewhere else -- simply drops out of the tab.
 */
export const storedRefsSchema = z.object({
  version: z.literal(1),
  characters: z.array(idSchema).max(200),
  locations: z.array(idSchema).max(200),
  frames: z.array(idSchema).max(1000),
})
export type StoredRefs = z.infer<typeof storedRefsSchema>

/** The two tabs. The kind is which list an asset lands in, and which
 *  instruction the sheet is generated from. */
export type RefKind = 'characters' | 'locations'

export const REF_KINDS = ['characters', 'locations'] as const

export function emptyRefs(): StoredRefs {
  return { version: 1, characters: [], locations: [], frames: [] }
}

/** Null on every session made before #690, and an unreadable value opens empty
 *  rather than 500ing the page -- `parseRun`'s rule. */
export function parseRefs(value: unknown): StoredRefs {
  const parsed = storedRefsSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyRefs()
}
