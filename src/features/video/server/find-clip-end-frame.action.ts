'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/**
 * The library row already holding this clip's end frame, if there is one.
 *
 * Continue extracts the last frame of a clip and writes it to the library.
 * Pressing it twice on one clip wrote the same picture twice -- two rows, two
 * objects, indistinguishable except by id (#542).
 *
 * **This asks provenance, not content.** `user_images.file_hash` exists and is
 * indexed, and answering "is this picture already in the library" with it was
 * the obvious route. It is the wrong one here, for two reasons found while
 * investigating: the two frame paths never compute a hash at all, so there is
 * nothing to match against; and byte-identity is not guaranteed anyway --
 * `captureFrame` encodes PNG in the browser, and two browsers do not
 * necessarily produce the same bytes from the same pixels. Josh works across
 * three Macs, so a content hash would silently stop deduping the moment the
 * second one is used.
 *
 * Provenance has neither problem. `stampFrameSource` already records the clip
 * a frame came from, and "have I already pulled the end of this clip" is
 * exactly the question Continue asks -- so it is answered directly rather than
 * inferred from bytes.
 *
 * `kind = 'end'` is what separates this from a scrubbed frame. `lab/frames`
 * stamps arbitrary positions in the same clip, and reusing a mid-clip frame as
 * a first frame would be worse than the duplicate this prevents. Rows stamped
 * before #542 carry no `kind`, so they do not match and Continue extracts
 * again -- once. Backfilling them is not worth a migration for a field that
 * heals on next use.
 *
 * Trashed frames are excluded. A soft-deleted row is one the user threw away;
 * handing it back as the first frame of the next generation would resurrect it
 * into a slot they never put it in.
 */
export async function findClipEndFrame({
  clipId,
}: {
  clipId: string
}): Promise<{ id: string; title: string | null } | null> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ id: string; title: string | null }>>`
    select id, title
    from user_images
    where user_id = ${userId}
      and deleted_at is null
      and generation_metadata->'frame_source'->>'clip_id' = ${clipId}
      and generation_metadata->'frame_source'->>'kind' = 'end'
    order by created_at desc
    limit 1
  `

  return rows.at(0) ?? null
}
