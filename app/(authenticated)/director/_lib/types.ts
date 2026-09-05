import { z } from 'zod'
import { settingsSchema } from '../clips'

export const idSchema = z.string().uuid()
export const nameSchema = z.string().trim().min(1).max(120)
export const storedClipSchema = z.object({
  id: idSchema,
  prompt: z.string().max(2000),
  mediaId: idSchema,
  endFrameId: idSchema,
  thumbnailId: idSchema,
  duration: z.number().positive().max(1800),
  model: z.string().max(200),
  elapsedMs: z.number().nonnegative().optional(),
  imported: z.boolean().optional(),
})
export const pendingSchema = z.object({
  id: idSchema,
  prompt: z.string().trim().min(1).max(2000),
  context: z.array(z.string().max(2000)).max(50),
  settings: settingsSchema,
  redo: z.boolean(),
  startedAt: z.number(),
  token: z.string().max(2048).optional(),
})
export const storedCutSchema = z.object({
  version: z.literal(1),
  clips: z.array(storedClipSchema).max(50),
  settings: settingsSchema,
  initialImage: idSchema.nullable(),
  pending: pendingSchema.nullable(),
  archives: z
    .array(
      z.object({
        id: z.string(),
        mediaId: idSchema,
        startedAt: z.number(),
        complete: z.boolean(),
        mimeType: z.string(),
      }),
    )
    .max(50)
    .default([]),
})
export type StoredClip = z.infer<typeof storedClipSchema>
export const exportInputSchema = z.object({
  id: idSchema,
  name: nameSchema,
  source: z.array(storedClipSchema).min(1).max(50),
})
export type ExportInput = z.infer<typeof exportInputSchema>
export interface SavedExport {
  id: string
  session_id: string
  name: string
  media_id: string
  thumbnail_id: string
  end_frame_id: string
  duration: number
  source: Array<StoredClip>
  created_at: string
}
export type StoredCut = z.infer<typeof storedCutSchema>
export interface Session {
  id: string
  name: string
  revision: number
  cut: StoredCut
  draft: string
  updated_at: string
}
export interface SessionSummary {
  id: string
  name: string
  count: number
  exports: number
  thumbnails: Array<string>
  updated_at: string
  pending: boolean
}
export function emptyStoredCut(): StoredCut {
  return {
    version: 1,
    clips: [],
    settings: { model: 'turbo', resolution: '768P', duration: 5 },
    initialImage: null,
    pending: null,
    archives: [],
  }
}
export function mediaUrl(id: string) {
  return `/director/media/${encodeURIComponent(id)}`
}
export function cutMediaIds(cut: StoredCut) {
  return [
    ...new Set([
      ...(cut.initialImage ? [cut.initialImage] : []),
      ...cut.clips.flatMap((clip) => [
        clip.mediaId,
        clip.endFrameId,
        clip.thumbnailId,
      ]),
      ...cut.archives.map((archive) => archive.mediaId),
    ]),
  ]
}
