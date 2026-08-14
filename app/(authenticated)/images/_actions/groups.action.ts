'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

/**
 * Groups (#319). Images-only, so they live with the route rather than in
 * `src/features/` -- one consumer means it belongs to that consumer
 * (`docs/DELTAS.md`).
 *
 * Every write carries `user_id` from `resolveAuth()`. A group id arriving from
 * the browser is never trusted on its own: the `where` always names the user
 * too, so a guessed uuid updates nothing.
 *
 * **Every write returns what it changed** (#331). A group write moves a cover,
 * a count, a preview strip and a position in the grid at once, and the client
 * used to buy that arithmetic with a second round trip -- the write, then
 * `listImageGroups()`, then a gallery re-read, serialised, with nothing on
 * screen moving until the last landed. The rows are already in hand here, so
 * the write says what happened and the client patches both lists from it.
 */

export interface ImageGroupSummary {
  id: string
  name: string
  /** The frozen cover, or the newest remaining member when it has none. */
  cover_image_id: string | null
  /** Members for the card's swatch strip, newest first. Six, not five: the
   *  card drops the cover from this list before rendering, so trimming to five
   *  here left it with four.
   *
   *  Pictures only -- a row with no `storage_path` is a generation still in the
   *  queue or one that failed, and it used to take the newest slot and render
   *  as a filled swatch of nothing (#350). Work in flight is not represented
   *  here at all: the strip is pictures, not a loading state. */
  preview_image_ids: Array<string>
  /** Live members -- trashed images are not in it, having lost `group_id`.
   *  Includes whatever is still generating. What is *in flight* is not here on
   *  purpose (#350): the client already holds every row and can count them
   *  without a round trip, and a summary that reported it would have to be
   *  re-read on every settle -- which is the churn this read is trying not to
   *  cause. */
  count: number
  /** The newest member's `sort_order`, which is what the grid sorts on. An
   *  empty group falls back to its own creation time so it still has a place. */
  sort_order: number
}

/**
 * What a write changed, in the two lists that render it.
 *
 * One shape for every write rather than a bespoke return each, so the client
 * has one `apply` rather than seven patches that can each disagree with the
 * database in their own way. Most writes leave most of it empty.
 */
export interface GroupWrite {
  /** Fresh summaries for every group the write touched -- upsert these. */
  groups: Array<ImageGroupSummary>
  /** Groups that no longer exist -- drop these. */
  gone: Array<string>
  /** Images whose membership changed, and what it changed to. */
  moved: { ids: Array<string>; groupId: string | null } | null
  /** Images that left the gallery entirely (the group card's delete icon). */
  trashed: Array<string>
}

const EMPTY_WRITE: GroupWrite = {
  groups: [],
  gone: [],
  moved: null,
  trashed: [],
}

/**
 * The one ordering the grid and the strip have to agree on (#350).
 *
 * `sort_order` is null on an upload -- only a generation or a drag ever sets it
 * -- and the grid has always fallen back to `created_at` (`sortByOrder` in
 * `use-gallery`). The group read did not: it ordered `nulls last`, so an image
 * uploaded into a group was *first* inside the group and *last* in that group's
 * strip. The card gained a count and nothing else moved, which reads as the
 * upload not having landed.
 *
 * Epoch seconds on both sides, so the two are the same number and not merely
 * the same intent.
 */
const ORDER_KEY = sql`coalesce(sort_order, extract(epoch from created_at))`

/**
 * Group summaries with the handful of member ids each card renders.
 *
 * One statement rather than a query per group: the lateral join gives each
 * group its own newest-five without a round trip each, and the count comes off
 * the same scan. `deleted_at is null` is belt-and-braces -- trashing clears
 * `group_id`, so a trashed row is already not a member -- but it keeps the read
 * correct if a row is ever soft-deleted by a path that forgets.
 *
 * `only` narrows it to the groups a write touched. Same statement either way,
 * so the summary a write returns is the one the full read would have given --
 * a second query shaped "close enough" is how the two drift apart.
 */
async function readGroups(
  userId: string,
  only: Array<string> | null,
): Promise<Array<ImageGroupSummary>> {
  const rows = await sql`
    select g.id,
           g.name,
           g.cover_image_id,
           coalesce(m.ids, '{}') as preview_image_ids,
           coalesce(m.n, 0) as count,
           coalesce(m.newest, extract(epoch from g.created_at))::float8 as sort_order
    from image_groups g
    left join lateral (
      select array_agg(ui.id order by ui.order_key desc)
               filter (where ui.storage_path is not null) as ids,
             count(*) as n,
             max(ui.order_key) as newest
      from (
        select id, storage_path, ${ORDER_KEY} as order_key
        from user_images
        where user_id = ${userId}
          and group_id = g.id
          and deleted_at is null
      ) ui
    ) m on true
    where g.user_id = ${userId}
      ${only ? sql`and g.id = any(${only})` : sql``}
    order by sort_order desc
  `

  // The lateral collects every member so `count` is the real one; the strip
  // shows five of them, and the card removes the cover before rendering --
  // hence six here, or a five-member group would draw four swatches.
  return (rows as unknown as Array<ImageGroupSummary>).map((g) => ({
    ...g,
    count: Number(g.count),
    // Never null -- `coalesce(m.ids, '{}')` above, which also covers the case
    // the `filter` introduced: a group whose only members are still generating
    // aggregates to null rather than to an empty array.
    preview_image_ids: g.preview_image_ids.slice(0, 6),
  }))
}

/**
 * Every picture in a group, newest first -- the expanded strip (#352).
 *
 * Its own read rather than a bigger `preview_image_ids`, because that field
 * rides on every group write (#331): a fifty-image group would put fifty uuids
 * in the payload of each rename, add and poll-driven refresh, to serve a panel
 * that is usually closed. This is asked for once, when the row is clicked.
 *
 * Same `ORDER_KEY` and the same `storage_path` filter as the summary, so the
 * expansion continues the strip rather than disagreeing with it.
 */
export async function listGroupMemberIds(
  groupId: string,
): Promise<Array<string>> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ id: string }>>`
    select id from user_images
    where user_id = ${userId}
      and group_id = ${groupId}
      and deleted_at is null
      and storage_path is not null
    order by ${ORDER_KEY} desc
  `
  return rows.map((r) => r.id)
}

export async function listImageGroups(): Promise<Array<ImageGroupSummary>> {
  const { userId } = await resolveAuth()
  return readGroups(userId, null)
}

/**
 * The groups these images are in *now*, before a move takes them out.
 *
 * A move changes two groups, not one: the count and cover of wherever the
 * images land, and of wherever they came from. Reading it before the update
 * is the only moment the old membership still exists.
 */
async function currentGroupIds(
  userId: string,
  imageIds: Array<string>,
): Promise<Array<string>> {
  const rows = await sql<Array<{ group_id: string }>>`
    select distinct group_id from user_images
    where user_id = ${userId} and id = any(${imageIds}) and group_id is not null
  `
  return rows.map((r) => r.group_id)
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
): Promise<GroupWrite> {
  const { userId } = await resolveAuth()

  const trimmed = name.trim()
  if (!trimmed) throw new Error('A group needs a name')
  if (trimmed.length > 200) throw new Error('That name is too long')

  const from =
    imageIds.length > 0 ? await currentGroupIds(userId, imageIds) : []

  const group = first(
    // sql-scope-exempt: an insert scopes by what it writes, and user_id comes
    // from resolveAuth(). There is no filter to add.
    await sql<Array<{ id: string }>>`
      insert into image_groups (user_id, name) values (${userId}, ${trimmed})
      returning id
    `,
  )
  if (!group) throw new Error('Could not create the group')

  let moved: Array<string> = []
  if (imageIds.length > 0) {
    const rows = await sql<Array<{ id: string }>>`
      update user_images set group_id = ${group.id}
      where user_id = ${userId} and id = any(${imageIds}) and deleted_at is null
      returning id
    `
    moved = rows.map((r) => r.id)
    await sql`
      update image_groups set cover_image_id = (
        select id from user_images
        where user_id = ${userId} and group_id = ${group.id}
          and deleted_at is null and storage_path is not null
        order by ${ORDER_KEY} desc
        limit 1
      )
      where id = ${group.id} and user_id = ${userId}
    `
  }

  return {
    groups: await readGroups(userId, [group.id, ...from]),
    gone: [],
    moved: { ids: moved, groupId: group.id },
    trashed: [],
  }
}

/** Move images into an existing group. Whatever group they were in, they leave. */
export async function addImagesToGroup(
  groupId: string,
  imageIds: Array<string>,
): Promise<GroupWrite> {
  const { userId } = await resolveAuth()
  if (imageIds.length === 0) return EMPTY_WRITE

  // The group is confirmed to be this user's before anything moves -- otherwise
  // a guessed id would file the caller's own images under a stranger's group.
  const group = first(
    await sql<Array<{ id: string }>>`
      select id from image_groups where id = ${groupId} and user_id = ${userId}
    `,
  )
  if (!group) throw new Error('That group no longer exists')

  const from = await currentGroupIds(userId, imageIds)

  const rows = await sql<Array<{ id: string }>>`
    update user_images set group_id = ${groupId}
    where user_id = ${userId} and id = any(${imageIds}) and deleted_at is null
    returning id
  `

  return {
    groups: await readGroups(userId, [groupId, ...from]),
    gone: [],
    moved: { ids: rows.map((r) => r.id), groupId },
    trashed: [],
  }
}

/**
 * Move a whole group's contents into another, and drop the emptied group (#350).
 *
 * "Move to group", not "Merge": it reads as an action on the images, which is
 * what it is. Doing it by hand was Ungroup, select all of them, Add to group --
 * three steps for one intention, and the middle one is the tedious part.
 *
 * Membership is an exclusive column, so the move is one update; nothing has to
 * be de-duplicated and nothing can end up in two groups. The source's frozen
 * cover is discarded with its row and the target keeps its own -- a merge that
 * re-covered the destination would silently undo a choice someone made.
 *
 * Destructive with no undo, like Ungroup, which already deletes a group row the
 * same way. The pictures are never at risk; only the grouping is.
 */
export async function moveGroupContents(
  sourceGroupId: string,
  targetGroupId: string,
): Promise<GroupWrite> {
  const { userId } = await resolveAuth()
  if (sourceGroupId === targetGroupId) return EMPTY_WRITE

  // Both ends confirmed to be this user's before anything moves, for the same
  // reason `addImagesToGroup` checks: a guessed id must update nothing.
  const owned = await sql<Array<{ id: string }>>`
    select id from image_groups
    where user_id = ${userId} and id = any(${[sourceGroupId, targetGroupId]})
  `
  if (owned.length !== 2) throw new Error('That group no longer exists')

  const rows = await sql<Array<{ id: string }>>`
    update user_images set group_id = ${targetGroupId}
    where user_id = ${userId} and group_id = ${sourceGroupId}
    returning id
  `
  await sql`
    delete from image_groups where id = ${sourceGroupId} and user_id = ${userId}
  `

  return {
    groups: await readGroups(userId, [targetGroupId]),
    gone: [sourceGroupId],
    moved: { ids: rows.map((r) => r.id), groupId: targetGroupId },
    trashed: [],
  }
}

/** Return images to top level. Deletes nothing -- see the Trash note in #319. */
export async function removeImagesFromGroup(
  imageIds: Array<string>,
): Promise<GroupWrite> {
  const { userId } = await resolveAuth()
  if (imageIds.length === 0) return EMPTY_WRITE

  const from = await currentGroupIds(userId, imageIds)

  const rows = await sql<Array<{ id: string }>>`
    update user_images set group_id = null
    where user_id = ${userId} and id = any(${imageIds})
    returning id
  `

  return {
    groups: from.length > 0 ? await readGroups(userId, from) : [],
    gone: [],
    moved: { ids: rows.map((r) => r.id), groupId: null },
    trashed: [],
  }
}

export async function renameImageGroup(
  groupId: string,
  name: string,
): Promise<GroupWrite> {
  const { userId } = await resolveAuth()

  const trimmed = name.trim()
  if (!trimmed) throw new Error('A group needs a name')
  if (trimmed.length > 200) throw new Error('That name is too long')

  await sql`
    update image_groups set name = ${trimmed}
    where id = ${groupId} and user_id = ${userId}
  `

  return { ...EMPTY_WRITE, groups: await readGroups(userId, [groupId]) }
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
 * -- is only visible in the migration. It is also what tells the client which
 * images just came back to top level.
 */
export async function dissolveImageGroup(groupId: string): Promise<GroupWrite> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ id: string }>>`
    update user_images set group_id = null
    where user_id = ${userId} and group_id = ${groupId}
    returning id
  `
  await sql`
    delete from image_groups where id = ${groupId} and user_id = ${userId}
  `

  return {
    groups: [],
    gone: [groupId],
    moved: { ids: rows.map((r) => r.id), groupId: null },
    trashed: [],
  }
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
export async function trashImageGroup(groupId: string): Promise<GroupWrite> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ id: string }>>`
    update user_images set deleted_at = now(), group_id = null
    where user_id = ${userId} and group_id = ${groupId} and deleted_at is null
    returning id
  `
  await sql`
    delete from image_groups where id = ${groupId} and user_id = ${userId}
  `

  return {
    groups: [],
    gone: [groupId],
    moved: null,
    trashed: rows.map((r) => r.id),
  }
}

/** Point a group's cover at one of its members. The image's own `...` menu. */
export async function setGroupCover(
  groupId: string,
  imageId: string,
): Promise<GroupWrite> {
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

  return { ...EMPTY_WRITE, groups: await readGroups(userId, [groupId]) }
}
