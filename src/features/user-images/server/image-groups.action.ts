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
 * Deliberately not `listImageGroups()` from `images/_actions/groups.action.ts`,
 * which is the Images grid's read: that one carries a cover, a preview strip,
 * a live member count and a sort position, all of which a filter throws away,
 * and it lives with the route that owns every group *write*. This is here
 * because the consumer is `ExistingImagePicker`, which four routes render --
 * a shared component reaching into one route's `_actions` is the wrong
 * direction.
 *
 * Names only, so there is nothing to keep in step: a group's membership,
 * cover and count can all change without this answer changing.
 */
export async function listImageGroupNames(): Promise<Array<ImageGroupName>> {
  const { userId } = await resolveAuth()

  return sql<Array<ImageGroupName>>`
    select id, name
    from image_groups
    where user_id = ${userId}
    order by name asc
  `
}
