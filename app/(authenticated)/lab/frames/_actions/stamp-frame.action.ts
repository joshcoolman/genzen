'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/**
 * Record which clip a frame was cut from, and where in it.
 *
 * The lab adds no migration, so this goes in `generation_metadata` -- jsonb,
 * already an open namespace. It is the one fact about a frame that cannot be
 * recovered afterwards: the bytes say nothing about their origin, and once the
 * page is closed the pairing is gone.
 *
 * A separate write rather than a field on `createImageRecord`: the frame goes
 * into the library through `saveFileToLibrary` like any other upload, and
 * teaching the app's only insert about a lab concept is the direction of
 * dependency this folder must not create.
 */
export async function stampFrameSource({
  imageId,
  clipId,
  timeSeconds,
}: {
  imageId: string
  clipId: string
  timeSeconds: number
}): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images
    set generation_metadata =
      coalesce(generation_metadata, '{}'::jsonb) ||
      ${sql.json({
        lab_frame: {
          clip_id: clipId,
          time_seconds: timeSeconds,
        },
      })}::jsonb
    where id = ${imageId} and user_id = ${userId}
  `
}
