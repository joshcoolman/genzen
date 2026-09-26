import { z } from 'zod'

export const idSchema = z.string().uuid()
export const nameSchema = z.string().trim().min(1).max(120)

/**
 * One cut: a name and an ordered list of clip ids (#662, #744).
 *
 * **Ids, not rows.** The clips are ordinary `user_images` rows made by
 * `generateVideo`, so everything about one -- its name, its poster, whether it
 * has finished -- is read off the library as it is now. A run holding copies
 * would show the name a clip had when it was added, and naming clips is half of
 * what a session is for.
 */
export const storedCutSchema = z.object({
  id: idSchema,
  name: nameSchema,
  clipIds: z.array(idSchema).max(200),
})
export type StoredCut = z.infer<typeof storedCutSchema>

/**
 * A session's cuts (#744): several runs of the same story, shown as tabs.
 *
 * **Version 3, and version 2 reads as one cut.** Version 2 was a single
 * `{ clipIds }`, which is exactly one cut with no name; `parseCuts` lifts it
 * into Cut 1 on the way in, so no SQL migration was needed and a session
 * written before #744 opens with its run intact. The lifted cut's id is the
 * session's own id -- it has to be the same on every read, or `active` would
 * point at a cut that no longer exists the next time the row is parsed.
 *
 * **Which cut is open is stored, not held by the page**, so every server path
 * that reads "the run" -- extraction, the chat, the storyboard -- reads the
 * one being looked at without being told, and three machines agree.
 *
 * There is always at least one cut: the last one cannot be deleted.
 */
export const storedCutsSchema = z.object({
  version: z.literal(3),
  active: idSchema,
  cuts: z.array(storedCutSchema).min(1).max(20),
})
export type StoredCuts = z.infer<typeof storedCutsSchema>

const legacyRunSchema = z.object({
  version: z.literal(2),
  clipIds: z.array(idSchema).max(200),
})

export function emptyCuts(sessionId: string): StoredCuts {
  return {
    version: 3,
    active: sessionId,
    cuts: [{ id: sessionId, name: 'Cut 1', clipIds: [] }],
  }
}

/** An unreadable value opens as one empty cut rather than 500ing the page. An
 *  `active` naming no cut falls back to the first, on the same reasoning. */
export function parseCuts(value: unknown, sessionId: string): StoredCuts {
  const legacy = legacyRunSchema.safeParse(value)
  if (legacy.success)
    return {
      version: 3,
      active: sessionId,
      cuts: [{ id: sessionId, name: 'Cut 1', clipIds: legacy.data.clipIds }],
    }
  const parsed = storedCutsSchema.safeParse(value)
  if (!parsed.success) return emptyCuts(sessionId)
  const { cuts, active } = parsed.data
  return cuts.some((cut) => cut.id === active)
    ? parsed.data
    : { ...parsed.data, active: cuts[0].id }
}

/** The cut the session is open on. */
export function activeCut(cuts: StoredCuts): StoredCut {
  return cuts.cuts.find((cut) => cut.id === cuts.active) ?? cuts.cuts[0]
}

/** The next free "Cut N": one past the highest number in use, so deleting
 *  Cut 2 never makes the next one a second Cut 3. */
export function nextCutName(cuts: StoredCuts): string {
  const numbers = cuts.cuts.map((cut) => {
    const match = /^Cut (\d+)$/.exec(cut.name)
    return match ? Number(match[1]) : 0
  })
  return `Cut ${Math.max(cuts.cuts.length, ...numbers) + 1}`
}

/** Every clip in every cut, for the trash that follows a session. */
export function allCutClipIds(cuts: StoredCuts): Array<string> {
  return cuts.cuts.flatMap((cut) => cut.clipIds)
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
 *  than 500ing the page, on the same reasoning as `parseCuts`. */
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
  /** Every cut, and which one is open (#744). */
  cuts: StoredCuts
  /** The open cut -- what every reader of "the run" means. */
  cut: StoredCut
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
 * Ids, not rows, on `StoredCut`'s reasoning. An id that resolves to nothing --
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
 *  rather than 500ing the page -- `parseCuts`'s rule. */
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
/** A board written before takes carried their own numbers holds `videoIds`,
 *  where the number *was* the position. Reading it as such loses nothing --
 *  those were the numbers on screen -- and is the last time position decides
 *  one. */
export const boardSceneSchema = z.preprocess(
  (value) => {
    if (value && typeof value === 'object') {
      const scene = value as { takes?: unknown; videoIds?: unknown }
      /* Tested on the value rather than on the key: a scene carrying `takes:
       undefined` is a scene with no takes read, and a key-presence check lets
       it through as though it had them. */
      if (!Array.isArray(scene.takes) && Array.isArray(scene.videoIds))
        return {
          ...value,
          takes: scene.videoIds.map((id, index) => ({ id, number: index + 1 })),
        }
    }
    return value
  },
  z.object({
    id: idSchema,
    /** The script line's own number -- its position in the run, which is what
     *  the Script tab numbers by. Never renumbered. */
    number: z.number().int().positive(),
    /** What is said in this scene, verbatim. **The record, and never the
     *  respelling** -- the Script tab, the transcript and the copy button read
     *  this one. */
    line: z.string().max(4000),
    /**
     * The line respelled so a model says it correctly (#700), or null when
     * nothing in it would be mispronounced.
     *
     * **Beside the line, never instead of it.** Read only when the video prompt
     * is assembled. Kling takes a plain prompt string -- no SSML, no phoneme
     * tags, no lexicon -- so the text sent is the pronunciation instruction, and
     * "day-KART" is the only way to get Descartes said right. That makes it a
     * lie about the text which is useful to exactly one consumer, and the moment
     * it reaches the record there is no telling what the film actually says.
     */
    spokenLine: z.string().max(4000).nullable().default(null),
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
    /**
     * The model this scene's frames were last generated with, or null for the
     * board's own (#699).
     *
     * Written only by a re-run, which is the one place a model is chosen. Retry
     * reads it so a repaired frame comes back from the model that drew the rest
     * of the pair, rather than silently reverting to the default and leaving a
     * row drawn by two hands.
     */
    model: z.string().max(80).nullable().default(null),
    /** The two frames. Null until submitted -- the closing one waits for the
     *  opening one to land, because it is generated from it. */
    openingId: idSchema.nullable(),
    closingId: idSchema.nullable(),
    /**
     * The takes generated of this section (#697), oldest first.
     *
     * **A list, because takes add rather than replace** -- the opposite of the
     * frames above. A frame is a spec and there is one of it; a take is a
     * candidate, and pressing Generate again is asking for another one, not
     * disowning the last. Nothing here is marked canonical: choosing a take per
     * row is what turns the board into a cut, and that is its own decision.
     *
     * **The number is stored, not the position.** It was `index + 1`, so
     * deleting take 2 renamed take 3 to take 2 -- the same renumbering around a
     * cut that did not happen that `dialogueOf` refuses to do to the script. A
     * take is a thing you watched and formed an opinion about, and its name has
     * to survive its neighbours being thrown away. Numbers are never reused: the
     * next one is the highest ever issued plus one.
     *
     * Defaulted, so a board stored before #697 parses rather than falling back
     * to an empty one and losing its frames.
     */
    takes: z
      .array(
        z.object({
          id: idSchema,
          number: z.number().int().positive(),
          /** Which model made it (#702). Null on a take from before there was
           *  a choice, which was all of them, on Kling. */
          model: z.string().max(80).nullable().default(null),
        }),
      )
      .max(20)
      .default([]),
  }),
)
export type BoardScene = z.infer<typeof boardSceneSchema>

export const storedBoardSchema = z.object({
  version: z.literal(1),
  scenes: z.array(boardSceneSchema).max(200),
  /**
   * The model sections are generated with (#702).
   *
   * **On the board rather than in the page's head**, so it travels with the
   * session and three machines agree about what this film is being made on.
   * Switched between generations on purpose: putting two takes of one row side
   * by side is the only way to judge the trade between them.
   */
  model: z.string().max(80).default('kling-o3-pro'),
  /**
   * One seed for the board, pinned the first time a model that takes one is
   * used (#687's reasoning, and #702's reason for existing).
   *
   * Kling's reference endpoint has no seed at all; Seedance's does, and the
   * same noise across sections is the only lever either endpoint offers on
   * whether a voice holds from one to the next.
   */
  seed: z.number().int().nonnegative().optional(),
})
export type StoredBoard = z.infer<typeof storedBoardSchema>

export function emptyBoard(): StoredBoard {
  return { version: 1, scenes: [], model: 'kling-o3-pro' }
}

/** Null on every session made before #695, and an unreadable value opens empty
 *  rather than 500ing the page -- `parseCuts`'s rule. */
export function parseBoard(value: unknown): StoredBoard {
  const parsed = storedBoardSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyBoard()
}

/** Every image a storyboard has made, for the trash that follows a session. */
export function boardImageIds(board: StoredBoard): Array<string> {
  return board.scenes.flatMap((scene) => [
    ...[scene.openingId, scene.closingId].filter(
      (id): id is string => id !== null,
    ),
    ...scene.takes.map((take) => take.id),
  ])
}
