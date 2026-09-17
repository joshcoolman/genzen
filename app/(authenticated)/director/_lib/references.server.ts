import 'server-only'
import { randomUUID } from 'node:crypto'
import { generateObject } from 'ai'
import sharp from 'sharp'
import { z } from 'zod'
import type { RefKind } from './types'
import inventoryPrompt from '#/lib/prompts/director-inventory.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { first, sql } from '#/lib/server/db.server'
import { extractClipFrame } from '#/lib/server/clip-frames.server'
import { createImageStorage } from '#/lib/image-storage'

/**
 * Turning a session's clips into reference sheets (#690).
 *
 * Three steps, and the middle one is the only model call that reads: stills
 * out of every clip, one vision pass that names the primary elements and picks
 * the stills that show each best, then one image generation per element with
 * those stills as references. The generations are `generateImageInternal`'s
 * job; everything up to them is here.
 */

/**
 * Where in a clip the stills are cut, as fractions of its length.
 *
 * Three is enough and the ends are avoided deliberately: a clip's first frame
 * is often the previous clip's ending -- the whole of how a run is built --
 * so sampling it again would hand the inventory the same picture twice under
 * two numbers. These are three distinct moments of the clip's own middle.
 */
const FRAME_FRACTIONS = [0.2, 0.5, 0.8]

/** How close two stills must be, in seconds, to be the same still. The reuse
 *  below matches on provenance rather than bytes, as `findClipEndFrame` does. */
const SAME_FRAME_EPSILON = 0.05

/** What the inventory sees: wide enough to name a face and a floor, small
 *  enough that twenty of them are one quick call rather than a minute of
 *  upload. The sheets are generated from the full-size rows, not from these. */
const INVENTORY_WIDTH = 768

/** More than this many elements is the model having counted background. The
 *  instruction says so too; this is what makes it true. */
const MAX_ELEMENTS = 6

/** References per sheet. The instruction asks for two or three; a model that
 *  returns eight would otherwise quietly pay for eight. */
const MAX_FRAMES_PER_ELEMENT = 3

interface ClipRow {
  id: string
  storage_path: string | null
  generation_metadata: Record<string, unknown> | null
}

/** A still, in the library and in memory. `bytes` is what the inventory is
 *  shown; the row id is what the sheet is generated from. */
export interface SessionFrame {
  imageId: string
  clipId: string
  timeSeconds: number
  bytes: Buffer
}

function requestedDuration(row: ClipRow): number | null {
  const seconds = (row.generation_metadata ?? {}).duration_seconds
  return typeof seconds === 'number' && seconds > 0 ? seconds : null
}

/**
 * The finished clips of a run, in order, as rows.
 *
 * Finished only: a pending clip has nothing behind `/img/[id]` to decode, and
 * an extraction that waited for one would be an extraction that never
 * returned. Director-scoped like every other read here.
 */
async function loadClips(
  userId: string,
  clipIds: Array<string>,
): Promise<Array<ClipRow>> {
  if (clipIds.length === 0) return []
  const rows = await sql<Array<ClipRow>>`
    select id, storage_path, generation_metadata
    from user_images
    where user_id = ${userId}
      and id = any(${clipIds})
      and source = 'ai_video'
      and origin = 'director'
      and status = 'completed'
      and deleted_at is null
  `
  const byId = new Map(rows.map((row) => [row.id, row]))
  return clipIds
    .map((id) => byId.get(id))
    .filter((row): row is ClipRow => row !== undefined && !!row.storage_path)
}

/** Stills this session already cut out of these clips, by clip and second.
 *  Provenance before bytes: a second extraction reuses them rather than
 *  decoding an identical PNG and paying for a second row. */
async function existingFrames(
  userId: string,
  clipIds: Array<string>,
): Promise<
  Array<{
    imageId: string
    clipId: string
    timeSeconds: number
    storagePath: string
  }>
> {
  if (clipIds.length === 0) return []
  const rows = await sql<
    Array<{
      id: string
      clip_id: string
      time_seconds: string | null
      storage_path: string | null
    }>
  >`
    select id, storage_path,
           generation_metadata->'frame_source'->>'clip_id' as clip_id,
           generation_metadata->'frame_source'->>'time_seconds' as time_seconds
    from user_images
    where user_id = ${userId}
      and origin = 'director'
      and deleted_at is null
      and generation_metadata->'frame_source'->>'clip_id' = any(${clipIds})
  `
  return rows
    .map((row) => ({
      imageId: row.id,
      clipId: row.clip_id,
      timeSeconds: Number(row.time_seconds),
      storagePath: row.storage_path!,
    }))
    .filter(
      (frame) => Number.isFinite(frame.timeSeconds) && !!frame.storagePath,
    )
}

/**
 * Put one still in the library as a Director-born row.
 *
 * Not `saveFileToLibrary`: that is the browser's path in, and it writes
 * `origin = 'upload'` because a paste authors nothing. This one *is* authored
 * by a surface -- Director cut it, nobody chose it, and it must be hidden with
 * everything else the session makes -- so it is written here, stamped in the
 * same statement rather than by a second `stampFrameSource` round trip.
 */
async function storeFrame({
  userId,
  clipId,
  timeSeconds,
  base64,
  width,
  height,
}: {
  userId: string
  clipId: string
  timeSeconds: number
  base64: string
  width: number
  height: number
}): Promise<string> {
  const bytes = Buffer.from(base64, 'base64')
  const storagePath = `${userId}/${Date.now()}_${randomUUID()}_frame.png`
  await createImageStorage().upload(storagePath, bytes, {
    contentType: 'image/png',
  })
  const row = first(
    await sql<Array<{ id: string }>>`
      insert into user_images
        (user_id, title, storage_path, file_name, file_size, mime_type,
         width, height, source, origin, generation_metadata)
      values
        (${userId}, ${'Reference frame'}, ${storagePath}, ${'frame.png'},
         ${bytes.length}, ${'image/png'}, ${width}, ${height},
         ${'ai_video_frame'}, ${'director'},
         ${sql.json({
           frame_source: {
             clip_id: clipId,
             youtube_id: null,
             time_seconds: timeSeconds,
             kind: 'scrub',
           },
         })}::jsonb)
      returning id
    `,
  )
  if (!row) throw new Error('The frame could not be stored.')
  return row.id
}

/**
 * Stills from every finished clip in the session, cut once and reused after.
 *
 * One download per clip, three seeks off it. The bytes come back with the rows
 * because the inventory needs to look at them and downloading them again from
 * the bucket to do so would be a round trip for something already in hand.
 *
 * **One position failing is tolerated; every position failing is not.** A clip
 * that will not decode at 50% is a still missing from the inventory, and the
 * rest of the film still describes itself -- so the loop catches and carries
 * on. But the same catch swallows a bucket that cannot be reached or an ffmpeg
 * that is not there, and an empty result then reaches the caller as "no
 * finished clips", which sends you to look at the run when the run was never
 * the problem. So the last reason is kept and thrown when nothing at all came
 * back off clips that do exist.
 */
export async function collectSessionFrames(
  userId: string,
  clipIds: Array<string>,
): Promise<Array<SessionFrame>> {
  const clips = await loadClips(userId, clipIds)
  if (clips.length === 0) return []

  const storage = createImageStorage()
  const known = await existingFrames(
    userId,
    clips.map((clip) => clip.id),
  )
  const frames: Array<SessionFrame> = []
  let failure: unknown = null

  for (const clip of clips) {
    const duration = requestedDuration(clip)
    if (!duration) continue
    const times = FRAME_FRACTIONS.map((f) => Number((duration * f).toFixed(3)))

    const reused = times.map((time) =>
      known.find(
        (frame) =>
          frame.clipId === clip.id &&
          Math.abs(frame.timeSeconds - time) <= SAME_FRAME_EPSILON,
      ),
    )

    // The clip is downloaded only if something still has to be cut out of it.
    let bytes: Uint8Array | null = null
    for (const [index, time] of times.entries()) {
      const hit = reused[index]
      try {
        if (hit) {
          const blob = await storage.download(hit.storagePath)
          frames.push({
            imageId: hit.imageId,
            clipId: clip.id,
            timeSeconds: hit.timeSeconds,
            bytes: Buffer.from(await blob.arrayBuffer()),
          })
          continue
        }
        if (!bytes) {
          const blob = await storage.download(clip.storage_path!)
          bytes = new Uint8Array(await blob.arrayBuffer())
        }
        const frame = await extractClipFrame({ bytes, timeSeconds: time })
        const imageId = await storeFrame({
          userId,
          clipId: clip.id,
          timeSeconds: time,
          base64: frame.base64,
          width: frame.width,
          height: frame.height,
        })
        frames.push({
          imageId,
          clipId: clip.id,
          timeSeconds: time,
          bytes: Buffer.from(frame.base64, 'base64'),
        })
      } catch (cause) {
        // Kept rather than discarded: see the note above. The last one wins,
        // and it is only ever read when every position failed, where they are
        // all the same reason anyway.
        failure = cause
      }
    }
  }

  if (frames.length === 0 && failure) {
    throw failure instanceof Error
      ? failure
      : new Error('No stills could be read out of these clips.')
  }

  return frames
}

/** What one element of the film is, as the inventory names it. */
export interface InventoryElement {
  name: string
  description: string
  /** Library rows, best first: the stills this sheet is generated from. */
  frameIds: Array<string>
}

const inventorySchema = z.object({
  elements: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      // **Plain numbers, and no length constraint on the array.** Anthropic's
      // native output format rejects both -- an array's `minItems`/`maxItems`,
      // and the `minimum`/`maximum` that Zod emits for `.int()` from the safe
      // integer range. The request fails outright with "For 'integer' type,
      // properties maximum, minimum are not supported", so the shape is a bare
      // number and both the count and the rounding are done below.
      frames: z.array(z.number()),
    }),
  ),
})

/**
 * One vision call over the stills, scoped to the kind asked for.
 *
 * The frames go in numbered, and the model answers with numbers rather than
 * ids -- an id is 36 characters of nothing for a model to hold, and one
 * mistyped character is a reference that resolves to someone else's row. The
 * numbers are mapped back here, where a number outside the set is simply
 * dropped.
 *
 * A chat's character description is handed over as well when the session has
 * one: the clips were generated from it, so it is the one statement of who is
 * on screen that does not have to be inferred from pixels.
 */
export async function inventory({
  kind,
  frames,
  character,
}: {
  kind: RefKind
  frames: Array<SessionFrame>
  character?: string | null
}): Promise<Array<InventoryElement>> {
  requireAiRole('vision')
  if (frames.length === 0) return []

  const thumbnails = await Promise.all(
    frames.map((frame) =>
      sharp(frame.bytes)
        .resize(INVENTORY_WIDTH, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer(),
    ),
  )

  const content: Array<
    { type: 'text'; text: string } | { type: 'image'; image: string }
  > = []
  content.push({
    type: 'text',
    text:
      kind === 'characters'
        ? 'Inventory the characters in these stills.'
        : 'Inventory the locations in these stills.',
  })
  if (character?.trim()) {
    content.push({
      type: 'text',
      text: `The film was generated from this description of its character: ${character.trim()}`,
    })
  }
  thumbnails.forEach((thumbnail, index) => {
    content.push({ type: 'text', text: `Frame ${index + 1}:` })
    content.push({
      type: 'image',
      image: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
    })
  })

  const { object } = await generateObject({
    model: ai.vision,
    maxOutputTokens: 4096,
    system: inventoryPrompt,
    schema: inventorySchema,
    messages: [{ role: 'user', content }],
  })

  return object.elements.slice(0, MAX_ELEMENTS).flatMap((element) => {
    const frameIds = [
      ...new Set(
        element.frames
          .map((n) => frames[Math.round(n) - 1]?.imageId)
          .filter((id): id is string => !!id),
      ),
    ].slice(0, MAX_FRAMES_PER_ELEMENT)
    // An element nothing shows cannot be drawn: the sheet would be the model's
    // imagination rather than this film's, which is the one thing a reference
    // must not be.
    if (frameIds.length === 0) return []
    return [
      {
        name: element.name.trim().slice(0, 120),
        description: element.description.trim().slice(0, 1000),
        frameIds,
      },
    ]
  })
}
