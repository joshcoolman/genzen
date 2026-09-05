import { z } from 'zod'

export const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024
export const MAX_EXPORT_BYTES = 512 * 1024 * 1024
export const exportManifestSchema = z
  .array(
    z.object({
      size: z
        .number()
        .int()
        .positive()
        .max(100 * 1024 * 1024),
      duration: z.number().positive().max(300),
    }),
  )
  .min(1)
  .max(50)
  .refine(
    (clips) =>
      clips.reduce((total, clip) => total + clip.size, 0) <= MAX_EXPORT_BYTES,
    'This export exceeds the 512 MB source limit.',
  )
  .refine(
    (clips) => clips.reduce((total, clip) => total + clip.duration, 0) <= 1800,
    'This export exceeds the 30-minute limit.',
  )
export type ExportManifest = z.infer<typeof exportManifestSchema>
