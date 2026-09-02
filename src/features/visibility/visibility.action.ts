'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/**
 * Hide or unhide many rows (#504, #537).
 *
 * The non-destructive sibling of trashing, and the reason it exists: the only
 * way to make something stop cluttering a wall was to trash it, so reducing
 * visual noise meant destroying work. A hidden row keeps its group, its canvas
 * membership and its objects -- nothing is cleared, because nothing is being
 * taken away.
 *
 * That is the whole difference from Trash, which clears `group_id` and canvas
 * membership so a restore has one destination (#319, #446). Unhiding is not a
 * restore; the row never went anywhere.
 *
 * **It never filtered on `source`**, which is why #537 was a surface job and
 * not a write one: this was already correct for a clip on the day #504 shipped
 * it, exactly as the group writes were correct for a clip before #517.
 *
 * One statement for the whole set, for the reason #329 gave: selecting things
 * is *for* bulk, and a loop of server actions is one round trip per row with a
 * route re-render on each.
 */
export async function setImagesHidden(
  imageIds: Array<string>,
  hidden: boolean,
): Promise<void> {
  const { userId } = await resolveAuth()
  if (imageIds.length === 0) return

  await sql`
    update user_images
    set hidden_at = ${hidden ? sql`now()` : sql`null`}
    where user_id = ${userId} and id = any(${imageIds})
  `
}
