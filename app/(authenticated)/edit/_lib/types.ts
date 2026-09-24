import { z } from 'zod'

export const idSchema = z.string().uuid()
export const nameSchema = z.string().trim().min(1).max(120)

/**
 * An edit is a name and an ordered list of trimmed clips (#726).
 *
 * `in` and `out` are seconds into the clip's own file, so a clip that has not
 * been trimmed is `{ in: 0, out: <its duration> }`. Ids, not rows, on
 * Director's reasoning: everything else about a clip -- name, poster, shape --
 * is read off the library row as it is now.
 *
 * One clip may appear more than once. A cut that reuses a shot is an ordinary
 * cut, so the position is the identity and the id is not unique here.
 */
export const cutClipSchema = z
  .object({
    id: idSchema,
    in: z.number().min(0),
    out: z.number().positive(),
  })
  .refine((clip) => clip.out > clip.in, 'out must be after in')
export type CutClip = z.infer<typeof cutClipSchema>

export const storedCutSchema = z.object({
  version: z.literal(1),
  clips: z.array(cutClipSchema).max(200),
})
export type StoredCut = z.infer<typeof storedCutSchema>

export function emptyCut(): StoredCut {
  return { version: 1, clips: [] }
}

/** An unreadable value opens empty rather than 500ing the page. */
export function parseCut(value: unknown): StoredCut {
  const parsed = storedCutSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyCut()
}

export interface Edit {
  id: string
  name: string
  /** Bumped by every write and checked by the next one: a second tab editing
   *  the same cut is rejected rather than silently overwriting. */
  revision: number
  cut: StoredCut
  /** The image group its saved frames go in (#729), or null until F has
   *  been pressed once. */
  group_id: string | null
  updated_at: string
}

/** A frame saved out of the edit: a library row in the edit's group. */
export interface EditFrame {
  id: string
  title: string
  created_at: string
}

export interface EditSummary {
  id: string
  name: string
  count: number
  /** The whole cut's length, in seconds. */
  seconds: number
  /** The first few clip ids, for the card's strip. */
  thumbnails: Array<string>
  updated_at: string
}
