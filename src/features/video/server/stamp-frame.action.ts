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
 *
 * **The origin is a clip or a YouTube video, and exactly one of them** (#613).
 * Frames can pull a still out of a pasted YouTube link, and that link is thrown
 * away with the session -- which makes the stamp *more* load-bearing there, not
 * less, because there is no row anywhere else to recover it from.
 * `findClipEndFrame` matches on `clip_id` equality and `kind = 'end'`, so a
 * YouTube stamp -- no clip, always `scrub` -- can never be handed back as a
 * clip's ending frame.
 *
 * `grid` is Grab Frames (#647), and it is a third kind rather than a `scrub`
 * because the sheet reads its own stamps back: a tile already imported is
 * marked as such, and a scrub at a coincidentally equal second must not mark
 * it.
 */
export async function stampFrameSource({
  imageId,
  clipId = null,
  youtubeId = null,
  timeSeconds,
  kind,
}: {
  imageId: string
  /** The clip it was cut from, when it was cut from one of ours. */
  clipId?: string | null
  /** The YouTube video it was grabbed from, when it was not. */
  youtubeId?: string | null
  timeSeconds: number
  /** `end` is the clip's final frame, `scrub` is wherever the user stopped,
   *  and `grid` is a tile picked off Grab Frames' contact sheet (#647). */
  kind: 'end' | 'scrub' | 'grid'
}): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images
    set generation_metadata =
      coalesce(generation_metadata, '{}'::jsonb) ||
      ${sql.json({
        frame_source: {
          clip_id: clipId,
          youtube_id: youtubeId,
          time_seconds: timeSeconds,
          kind,
        },
      })}::jsonb
    where id = ${imageId} and user_id = ${userId}
  `
}
