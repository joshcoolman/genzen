'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

/**
 * Groups (#319). Images-only, so they live with the route rather than in
 * `src/features/` -- one consumer means it belongs to that consumer
 * (`docs/DELTAS.md`).
 *
 * Every write is one statement, and every one of them carries `user_id` from
 * `resolveAuth()`. A group id arriving from the browser is never trusted on its
 * own: the `where` always names the user too, so a guessed uuid updates nothing.
 */

export interface ImageGroupSummary {
  id: string
  name: string
  /** The frozen cover, or the newest remaining member when it has none. */
  cover_image_id: string | null
  /** Up to five members for the card's swatch strip, newest first. */
  preview_image_ids: Array<string>
  /** Live members -- trashed images are not in it, having lost `group_id`. */
  count: number
  /** The newest member's `sort_order`, which is what the grid sorts on. An
   *  empty group falls back to its own creation time so it still has a place. */
  sort_order: number
}

/**
 * Every group with the handful of member ids its card renders.
 *
 * One statement rather than a query per group: the lateral join gives each
 * group its own newest-five without a round trip each, and the count comes off
 * the same scan. `deleted_at is null` is belt-and-braces -- trashing clears
 * `group_id`, so a trashed row is already not a member -- but it keeps the read
 * correct if a row is ever soft-deleted by a path that forgets.
 */
export async function listImageGroups(): Promise<Array<ImageGroupSummary>> {
  const { userId } = await resolveAuth()

  const rows = await sql`
    select g.id,
           g.name,
           g.cover_image_id,
           coalesce(m.ids, '{}') as preview_image_ids,
           coalesce(m.n, 0) as count,
           coalesce(m.newest, extract(epoch from g.created_at))::float8 as sort_order
    from image_groups g
    left join lateral (
      select array_agg(ui.id order by ui.sort_order desc nulls last) as ids,
             count(*) as n,
             max(ui.sort_order) as newest
      from (
        select id, sort_order
        from user_images
        where user_id = ${userId}
          and group_id = g.id
          and deleted_at is null
        order by sort_order desc nulls last
      ) ui
    ) m on true
    where g.user_id = ${userId}
    order by sort_order desc
  `

  // The lateral collects every member so `count` is the real one; the strip
  // only ever shows five, and trimming here keeps the ids off the wire.
  return (rows as unknown as Array<ImageGroupSummary>).map((g) => ({
    ...g,
    count: Number(g.count),
    // Never null -- `coalesce(m.ids, '{}')` above -- so no fallback here.
    preview_image_ids: g.preview_image_ids.slice(0, 5),
  }))
}

/**
 * Create a group and move the given images into it.
 *
 * `imageIds` may be empty: naming a group before there is anything in it is a
 * real way to start, and it falls out of the same call rather than needing its
 * own. The cover is the newest member at this moment, then frozen -- picking it
 * automatically is the point, because the modal step that used to ask is what
 * made grouping a chore.
 */
export async function createImageGroup(
  name: string,
  imageIds: Array<string>,
): Promise<{ id: string }> {
  const { userId } = await resolveAuth()

  const trimmed = name.trim()
  if (!trimmed) throw new Error('A group needs a name')
  if (trimmed.length > 200) throw new Error('That name is too long')

  const group = first(
    // sql-scope-exempt: an insert scopes by what it writes, and user_id comes
    // from resolveAuth(). There is no filter to add.
    await sql<Array<{ id: string }>>`
      insert into image_groups (user_id, name) values (${userId}, ${trimmed})
      returning id
    `,
  )
  if (!group) throw new Error('Could not create the group')

  if (imageIds.length > 0) {
    await sql`
      update user_images set group_id = ${group.id}
      where user_id = ${userId} and id = any(${imageIds}) and deleted_at is null
    `
    await sql`
      update image_groups set cover_image_id = (
        select id from user_images
        where user_id = ${userId} and group_id = ${group.id}
          and deleted_at is null and storage_path is not null
        order by sort_order desc nulls last
        limit 1
      )
      where id = ${group.id} and user_id = ${userId}
    `
  }

  return { id: group.id }
}

/** Move images into an existing group. Whatever group they were in, they leave. */
export async function addImagesToGroup(
  groupId: string,
  imageIds: Array<string>,
): Promise<void> {
  const { userId } = await resolveAuth()
  if (imageIds.length === 0) return

  // The group is confirmed to be this user's before anything moves -- otherwise
  // a guessed id would file the caller's own images under a stranger's group.
  const group = first(
    await sql<Array<{ id: string }>>`
      select id from image_groups where id = ${groupId} and user_id = ${userId}
    `,
  )
  if (!group) throw new Error('That group no longer exists')

  await sql`
    update user_images set group_id = ${groupId}
    where user_id = ${userId} and id = any(${imageIds}) and deleted_at is null
  `
}

/** Return images to top level. Deletes nothing -- see the Trash note in #319. */
export async function removeImagesFromGroup(
  imageIds: Array<string>,
): Promise<void> {
  const { userId } = await resolveAuth()
  if (imageIds.length === 0) return

  await sql`
    update user_images set group_id = null
    where user_id = ${userId} and id = any(${imageIds})
  `
}

export async function renameImageGroup(
  groupId: string,
  name: string,
): Promise<void> {
  const { userId } = await resolveAuth()

  const trimmed = name.trim()
  if (!trimmed) throw new Error('A group needs a name')
  if (trimmed.length > 200) throw new Error('That name is too long')

  await sql`
    update image_groups set name = ${trimmed}
    where id = ${groupId} and user_id = ${userId}
  `
}

/**
 * Dissolve: every member returns to top level, then the group row goes.
 *
 * There is deliberately no delete-group-and-its-images. Trash and select mode
 * already cover that, and a group that can destroy eleven images is a new way
 * to lose work for no new capability.
 *
 * The explicit update is not redundant with `on delete set null`. The
 * constraint would do the same thing, but leaving it implicit means the one
 * behaviour a reader will want to check -- that dissolving keeps the pictures
 * -- is only visible in the migration.
 */
export async function dissolveImageGroup(groupId: string): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images set group_id = null
    where user_id = ${userId} and group_id = ${groupId}
  `
  await sql`
    delete from image_groups where id = ${groupId} and user_id = ${userId}
  `
}

/**
 * Trash the group and everything in it.
 *
 * The card's delete icon, and the one group action that asks first -- it is the
 * only one that touches pictures. Safe to offer because it *trashes*: the
 * images soft-delete, land in Trash beside every other deleted image, and
 * restore from there like anything else. Nothing is destroyed here, which is
 * what separates this from the delete-group-and-its-images that #319 refused.
 *
 * `group_id = null` on the same statement, as every other trash path does:
 * restore has one destination. That also means the group row is left with no
 * members by the time it is deleted, so the delete cannot cascade anywhere.
 */
export async function trashImageGroup(groupId: string): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images set deleted_at = now(), group_id = null
    where user_id = ${userId} and group_id = ${groupId} and deleted_at is null
  `
  await sql`
    delete from image_groups where id = ${groupId} and user_id = ${userId}
  `
}

/** Point a group's cover at one of its members. The image's own `...` menu. */
export async function setGroupCover(
  groupId: string,
  imageId: string,
): Promise<void> {
  const { userId } = await resolveAuth()

  // Scoped to a member of *this* group: a cover pointing at an image the group
  // does not contain would render something the group does not have.
  await sql`
    update image_groups set cover_image_id = ${imageId}
    where id = ${groupId} and user_id = ${userId}
      and exists (
        select 1 from user_images
        where id = ${imageId} and user_id = ${userId} and group_id = ${groupId}
      )
  `
}
