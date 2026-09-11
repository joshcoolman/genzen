import { z } from 'zod'

export const MAX_FRAMES = 32
export const frameSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(100),
  left: z.number().int().nonnegative(),
  top: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})
export type FrameRegion = z.infer<typeof frameSchema>
export interface FrameReview {
  sourceId: string
  sourceHash: string
  width: number
  height: number
  frames: Array<FrameRegion>
}

export function validateFrames(
  frames: Array<FrameRegion>,
  width: number,
  height: number,
) {
  const parsed = z.array(frameSchema).min(1).max(MAX_FRAMES).parse(frames)
  if (new Set(parsed.map((f) => f.id)).size !== parsed.length)
    throw new Error('Each frame must have a unique identity.')
  if (parsed.some((f) => f.left + f.width > width || f.top + f.height > height))
    throw new Error(
      'A frame extends beyond the source image. Adjust its boundary before extracting.',
    )
  if (
    new Set(parsed.map((f) => `${f.left},${f.top},${f.width},${f.height}`))
      .size !== parsed.length
  )
    throw new Error(
      'Two frames have the same boundary. Deselect one before extracting.',
    )
  return parsed
}

/** Model coordinates use a 1000×1000 scale independent of the vision resize. */
export function pixelRegion(
  box: { left: number; top: number; right: number; bottom: number },
  width: number,
  height: number,
) {
  const left = Math.round((box.left * width) / 1000)
  const top = Math.round((box.top * height) / 1000)
  return {
    left,
    top,
    width: Math.round((box.right * width) / 1000) - left,
    height: Math.round((box.bottom * height) / 1000) - top,
  }
}
