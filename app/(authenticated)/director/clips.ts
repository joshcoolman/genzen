import { z } from 'zod'

export const modelSchema = z.enum(['max', 'turbo'])
export const DURATIONS = [5, 10, 15] as const
export const settingsSchema = z.object({
  model: modelSchema,
  resolution: z.enum(['480P', '768P']),
  duration: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
})
export const ENDPOINTS = {
  max: 'minimax/h3-max/image-to-video',
  turbo: 'minimax/h3-max-turbo/image-to-video',
} as const
export const PROMPT_LIMIT = 2000
export const clipRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(PROMPT_LIMIT),
  context: z.array(z.string().max(PROMPT_LIMIT)).max(50),
  settings: settingsSchema,
})
export type Settings = z.infer<typeof settingsSchema>
export interface Clip {
  id: string
  prompt: string
  blob: Blob
  endFrame: Blob
  duration: number
  model: string
  elapsedMs?: number
  imported?: boolean
}
export interface PendingClip {
  id: string
  prompt: string
  context: Array<string>
  settings: Settings
  redo: boolean
  /** The section this request replaces, or null when it appends. `redo` is the
   * old spelling of "replace the last one" and is kept only so a request saved
   * before #643 still lands in the right place. */
  replace?: number | null
  startedAt: number
  token?: string
}
export interface Cut {
  version: 1
  clips: Array<Clip>
  settings: Settings
  initialImage: Blob | null
  pending: PendingClip | null
  /** The section under review, if any. The clip it is holding stays on the
   * server; the client only needs to know which section is open. */
  review: number | null
}
export function emptyCut(): Cut {
  return {
    version: 1,
    clips: [],
    settings: { model: 'turbo', resolution: '768P', duration: 5 },
    initialImage: null,
    pending: null,
    review: null,
  }
}

/** A replacement rolls back the *inputs*, never continues from the rejected
 * ending. It is also pinned at both seams when a later section exists: the
 * replaced clip's own ending frame is the frame the next section opened on,
 * so ending there is what keeps that join. */
export function generationBase(cut: Cut, replace: number | null) {
  if (replace !== null) {
    if (replace >= cut.clips.length)
      throw new Error('That section no longer exists.')
    if (cut.clips[replace].imported)
      throw new Error('Imported recordings can be continued, but not redone.')
  }
  const preceding =
    replace === null ? cut.clips : cut.clips.slice(0, Math.max(0, replace))
  if (preceding.length >= 50)
    throw new Error('This experiment supports up to 50 sections per cut.')
  const tail =
    replace !== null && replace < cut.clips.length - 1
      ? cut.clips[replace].endFrame
      : null
  return {
    image: preceding.at(-1)?.endFrame ?? cut.initialImage,
    tail,
    context: preceding.map((clip) => clip.prompt),
  }
}

/** Where a finished request lands. */
export function replacedIndex(pending: PendingClip, clips: number) {
  if (pending.replace !== undefined && pending.replace !== null)
    return pending.replace
  return pending.redo ? clips - 1 : null
}

export function completeClip(cut: Cut, pending: PendingClip, clip: Clip): Cut {
  if (cut.pending?.id !== pending.id) return cut
  const at = replacedIndex(pending, cut.clips.length)
  return {
    ...cut,
    pending: null,
    clips:
      at === null
        ? [...cut.clips, clip]
        : cut.clips.map((existing, index) => (index === at ? clip : existing)),
  }
}

export function nextIndex(index: number, length: number) {
  return length ? (index + 1) % length : 0
}
export function latestJoin(length: number) {
  return Math.max(0, length - 2)
}
