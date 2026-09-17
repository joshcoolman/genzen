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
  /** The storyboard planned from its script and those sheets (#695). */
  board: StoredBoard
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

/**
 * A session's storyboard (#695).
 *
 * **A scene is a numbered script line**, and its two frames are the ends of the
 * video section that line will become. The script's numbering is the board's:
 * the boundaries are not something to work out, and the number here prints the
 * same as the number on the Script tab.
 *
 * Drawing them is the cheapest way to find out whether the character sheet, the
 * location sheets and the script add up to a story, which otherwise costs a
 * whole video to answer.
 *
 * **The plan is stored where the run's assets are not.** Everything else a
 * session holds is ids, because the facts are on the library row. A scene is
 * not: what place it happens in and what its two frames were asked for is
 * recorded nowhere -- the chat wrote a scene per answer and it only ever lived
 * inside the composed clip prompt. So the plan is written down, and the frames
 * stay ids.
 *
 * **Ordered, and replaced rather than added to.** The reference tabs are
 * collections pruned by deleting; a storyboard is a sequence, so a re-run of
 * one scene takes that scene's place and the pair it replaced goes to Trash.
 *
 * Two hundred scenes, matching the run's own cap: the board is one row per
 * clip, so the two can never disagree about how long a session may be.
 */
export const boardSceneSchema = z.object({
  id: idSchema,
  /** The script line's own number -- its position in the run, which is what
   *  the Script tab numbers by. Never renumbered. */
  number: z.number().int().positive(),
  /** What is said in this scene, verbatim. */
  line: z.string().max(4000),
  /** How long the section runs, off the clip's row. **The size of the change
   *  between the two frames**: five seconds is a breath, twelve is a move. A
   *  measurement rather than a recommendation, as the Script tab's is. */
  seconds: z.number().nullable(),
  /** The character sheets this scene is generated from. */
  characterIds: z.array(idSchema).max(6),
  /** The location sheet it is set in, or null when the plan named none. */
  locationId: idSchema.nullable(),
  openingPrompt: z.string().max(4000),
  closingPrompt: z.string().max(4000),
  /** What was typed into a re-run of this scene, kept so the row can say what
   *  it was asked for. Null until one. */
  guidance: z.string().max(2000).nullable(),
  /** The two frames. Null until submitted -- the closing one waits for the
   *  opening one to land, because it is generated from it. */
  openingId: idSchema.nullable(),
  closingId: idSchema.nullable(),
})
export type BoardScene = z.infer<typeof boardSceneSchema>

export const storedBoardSchema = z.object({
  version: z.literal(1),
  scenes: z.array(boardSceneSchema).max(200),
})
export type StoredBoard = z.infer<typeof storedBoardSchema>

export function emptyBoard(): StoredBoard {
  return { version: 1, scenes: [] }
}

/** Null on every session made before #695, and an unreadable value opens empty
 *  rather than 500ing the page -- `parseRun`'s rule. */
export function parseBoard(value: unknown): StoredBoard {
  const parsed = storedBoardSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyBoard()
}

/** Every image a storyboard has made, for the trash that follows a session. */
export function boardImageIds(board: StoredBoard): Array<string> {
  return board.scenes.flatMap((scene) =>
    [scene.openingId, scene.closingId].filter(
      (id): id is string => id !== null,
    ),
  )
}
