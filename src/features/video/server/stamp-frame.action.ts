'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/**
 * Record which clip a frame was cut from, and where in it.
 *
 * No migration for it: this goes in `generation_metadata` -- jsonb, already an
 * open namespace. It is the one fact about a frame that cannot be recovered
 * afterwards, since the bytes say nothing about their origin.
 *
 * A separate write rather than a field on `createImageRecord`: a frame goes
 * into the library through `saveFileToLibrary` like any other upload, and the
 * app's only insert should not have to know what a frame is.
 *
 * The key is `frame_source`. It was `lab_frame` while `lab/frames` was the only
 * caller and Video's Continue made that name wrong (#494); the rename cost
 * nothing and no rows needed touching, because nothing read it.
 *
 * Something reads it now. `kind` separates the end frame Continue pulls from
 * the arbitrary position `lab/frames` scrubs to, which is what lets
 * `findClipEndFrame` reuse the first without ever handing back the second
 * (#542). Rows written before that carry no `kind` and simply do not match.
 */
export async function stampFrameSource({
  imageId,
  clipId,
  timeSeconds,
  kind,
}: {
  imageId: string
  clipId: string
  timeSeconds: number
  /** `end` is the clip's final frame; `scrub` is wherever the user stopped. */
  kind: 'end' | 'scrub'
}): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images
    set generation_metadata =
      coalesce(generation_metadata, '{}'::jsonb) ||
      ${sql.json({
        frame_source: {
          clip_id: clipId,
          time_seconds: timeSeconds,
          kind,
        },
      })}::jsonb
    where id = ${imageId} and user_id = ${userId}
  `
}
