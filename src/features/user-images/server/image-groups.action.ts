'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

export interface ImageGroupName {
  id: string
  name: string
}

/**
 * Every group's id and name, for narrowing a list of images down to one.
 *
 * Deliberately not `listImageGroups()` from `src/features/groups/`, which is
 * the Images grid's read: that one carries a cover, a preview strip, a live
 * member count and a sort position, all of which a filter throws away. Names
 * only, so there is nothing to keep in step -- a group's membership, cover and
 * count can all change without this answer changing.
 *
 * **Image groups only** (#517). The consumer is `ExistingImagePicker`, which
 * picks a still out of the library; a video group in that list would be a
 * filter that always narrows to nothing, since no clip is ever in it. The
 * filter is here rather than left to the caller because every caller of this
 * wants the same answer.
 */
export async function listImageGroupNames(): Promise<Array<ImageGroupName>> {
  const { userId } = await resolveAuth()

  return sql<Array<ImageGroupName>>`
    select id, name
    from image_groups
    where user_id = ${userId} and kind = 'image'
    order by name asc
  `
}
