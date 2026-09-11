import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import {
  MAX_FRAMES,
  frameSchema,
  pixelRegion,
  validateFrames,
} from './frame-extraction'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/image-storage'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { loadVisionImage } from '#/lib/server/vision-image.server'
import { EXTRACT_FRAMES_SKILL } from '#/features/ai-images/skills/registry'
import { saveDerivedImage } from '#/features/user-images/server/save-derived-image.server'

const coordinate = z.number().int().min(0).max(1000)
const detectionSchema = z.object({
  frames: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        left: coordinate,
        top: coordinate,
        right: coordinate,
        bottom: coordinate,
      }),
    )
    .max(MAX_FRAMES),
})

export async function loadFrameSource(sourceId: string, userId: string) {
  z.uuid().parse(sourceId)
  const row = first(
    await sql<
      Array<{
        storage_path: string | null
        title: string
        mime_type: string | null
      }>
    >`
    select storage_path, title, mime_type from user_images
    where id = ${sourceId} and user_id = ${userId} and deleted_at is null and status = 'completed'
  `,
  )
  if (!row?.storage_path || row.mime_type === 'video/mp4')
    throw new Error(
      'The source image is unavailable. Choose a completed image.',
    )
  const buffer = Buffer.from(
    await (await createImageStorage().download(row.storage_path)).arrayBuffer(),
  )
  const meta = await sharp(buffer, { limitInputPixels: 80_000_000 }).metadata()
  if ((meta.pages ?? 1) > 1)
    throw new Error('Choose a still image before extracting frames.')
  const oriented = await sharp(buffer, { limitInputPixels: 80_000_000 })
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true })
  return {
    ...row,
    buffer: oriented.data,
    width: oriented.info.width,
    height: oriented.info.height,
    sourceHash: createHash('sha256').update(buffer).digest('hex'),
  }
}

export async function detectFramesInternal(sourceId: string) {
  const { userId } = await resolveAuth()
  requireAiRole('reasoning')
  const source = await loadFrameSource(sourceId, userId)
  const vision = await loadVisionImage(source.storage_path!)
  if (!vision)
    throw new Error('The source image could not be read. Try another image.')
  const { default: system } =
    await import('#/lib/prompts/extract-image-frames.md')
  const { output } = await generateText({
    model: ai.reasoning,
    system,
    providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
    output: Output.object({ schema: detectionSchema }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: vision.data, mediaType: vision.mediaType },
        ],
      },
    ],
  })
  const frames = output.frames.map((f) => ({
    id: crypto.randomUUID(),
    label: f.label,
    ...pixelRegion(f, source.width, source.height),
  }))
  if (frames.length) validateFrames(frames, source.width, source.height)
  return {
    sourceId,
    sourceHash: source.sourceHash,
    width: source.width,
    height: source.height,
    frames,
  }
}

export const extractionSchema = z.object({
  sourceId: z.uuid(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  batchId: z.uuid(),
  frames: z.array(frameSchema).min(1).max(MAX_FRAMES),
})
export async function extractFramesInternal(
  input: z.infer<typeof extractionSchema>,
) {
  const { userId } = await resolveAuth()
  const data = extractionSchema.parse(input)
  const source = await loadFrameSource(data.sourceId, userId)
  if (source.sourceHash !== data.sourceHash)
    throw new Error(
      'The source image changed. Review its frames again before extracting.',
    )
  const frames = validateFrames(data.frames, source.width, source.height)
  await sql`
    insert into image_groups (id, user_id, name, kind, manual_order)
    values (${data.batchId}, ${userId}, ${`${source.title.slice(0, 150)} · Frames`}, 'image', true)
    on conflict (id) do nothing
  `
  const group = first(
    await sql<Array<{ id: string }>>`
    select id from image_groups where id = ${data.batchId} and user_id = ${userId} and kind = 'image'
  `,
  )
  if (!group)
    throw new Error(
      'The extraction group is unavailable. Start a new extraction.',
    )
  const outcomes: Array<{
    frameId: string
    recordId: string | null
    error: string | null
  }> = []
  // Bounded batches reuse the oriented source bytes.
  for (let offset = 0; offset < frames.length; offset += 4) {
    outcomes.push(
      ...(await Promise.all(
        frames.slice(offset, offset + 4).map(async (frame, index) => {
          const position = offset + index + 1
          try {
            const bounds = {
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
            }
            const fingerprint = createHash('sha256')
              .update(
                JSON.stringify({
                  sourceId: data.sourceId,
                  sourceHash: data.sourceHash,
                  bounds,
                  position,
                }),
              )
              .digest('hex')
            const buffer = await sharp(source.buffer)
              .extract(bounds)
              .png()
              .toBuffer()
            const recordId = await saveDerivedImage({
              userId,
              buffer,
              title: `Frame ${position} · ${frame.label}`,
              width: frame.width,
              height: frame.height,
              position,
              groupId: group.id,
              idempotencyKey: `${userId}:extract:${data.batchId}:${frame.id}`,
              fingerprint,
              metadata: {
                generation_type: 'frame_extraction',
                source_image_id: data.sourceId,
                frame_extraction: {
                  skill: EXTRACT_FRAMES_SKILL.id,
                  version: EXTRACT_FRAMES_SKILL.version,
                  source_image_id: data.sourceId,
                  source_width: source.width,
                  source_height: source.height,
                  source_hash: data.sourceHash,
                  bounds,
                  position,
                  batch_id: data.batchId,
                },
              },
            })
            return { frameId: frame.id, recordId, error: null }
          } catch (error) {
            return {
              frameId: frame.id,
              recordId: null,
              error:
                error instanceof Error
                  ? error.message
                  : 'Could not save this frame. Try again.',
            }
          }
        }),
      )),
    )
  }
  return { groupId: group.id, outcomes }
}
