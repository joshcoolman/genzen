import { z } from 'zod'

export const modelSchema = z.enum(['max', 'turbo'])
export const settingsSchema = z.object({
  model: modelSchema,
  resolution: z.enum(['480P', '768P']),
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
  startedAt: number
  token?: string
}
export interface Cut {
  version: 1
  clips: Array<Clip>
  settings: Settings
  initialImage: Blob | null
  pending: PendingClip | null
}
export function emptyCut(): Cut {
  return {
    version: 1,
    clips: [],
    settings: { model: 'turbo', resolution: '768P' },
    initialImage: null,
    pending: null,
  }
}

/** Redo rolls back the *inputs*, never continues from the rejected ending. */
export function generationBase(cut: Cut, redo: boolean) {
  if (redo && (!cut.clips.length || cut.clips.at(-1)?.imported))
    throw new Error('Imported recordings can be continued, but not redone.')
  const preceding = redo ? cut.clips.slice(0, -1) : cut.clips
  if (preceding.length >= 50)
    throw new Error('This experiment supports up to 50 sections per cut.')
  return {
    image: preceding.at(-1)?.endFrame ?? cut.initialImage,
    context: preceding.map((clip) => clip.prompt),
  }
}

export function completeClip(cut: Cut, pending: PendingClip, clip: Clip): Cut {
  if (cut.pending?.id !== pending.id) return cut
  return {
    ...cut,
    pending: null,
    clips: pending.redo
      ? [...cut.clips.slice(0, -1), clip]
      : [...cut.clips, clip],
  }
}

export function nextIndex(index: number, length: number) {
  return length ? (index + 1) % length : 0
}
export function latestJoin(length: number) {
  return Math.max(0, length - 2)
}
