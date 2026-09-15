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
