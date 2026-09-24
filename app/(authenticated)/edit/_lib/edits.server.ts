import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  emptyCut,
  idSchema,
  nameSchema,
  parseCut,
  storedCutSchema,
} from './types'
import type { CutClip, Edit, EditFrame, EditSummary } from './types'
import { first, jsonb, sql } from '#/lib/server/db.server'

/**
 * An edit's name and its cut (#726). Copied from Director's sessions module
 * and cut down: an edit owns no clips -- they are Video's -- so deleting one
 * is a delete and nothing goes to Trash.
 */
export async function getEdit(owner: string, id: string): Promise<Edit | null> {
  if (!idSchema.safeParse(id).success) return null
  const row = first(
    await sql<Array<Edit>>`
    select id, name, revision, cut, group_id, to_json(updated_at)#>>'{}' as updated_at
    from edits where id = ${id} and user_id = ${owner}
  `,
  )
  return row ? { ...row, cut: parseCut(row.cut) } : null
}

export async function requireEdit(owner: string, id: string) {
  const edit = await getEdit(owner, id)
  if (!edit) throw new Error('Edit not found.')
  return edit
}

export async function listEdits(owner: string): Promise<Array<EditSummary>> {
  const rows = await sql<Array<Edit>>`
    select id, name, cut, to_json(updated_at)#>>'{}' as updated_at
    from edits where user_id = ${owner} order by updated_at desc
  `
  return rows.map((row) => {
    const cut = parseCut(row.cut)
    return {
      id: row.id,
      name: row.name,
      count: cut.clips.length,
      seconds: cut.clips.reduce((sum, clip) => sum + clip.out - clip.in, 0),
      thumbnails: cut.clips.slice(0, 6).map((clip) => clip.id),
      updated_at: row.updated_at,
    }
  })
}

export async function createEdit(
  owner: string,
  name: string,
  id: string = randomUUID(),
) {
  idSchema.parse(id)
  name = nameSchema.parse(name)
  await sql`
    insert into edits (id, user_id, name, cut)
    values (${id}, ${owner}, ${name}, ${jsonb(emptyCut())})
    on conflict (id) do nothing
  `
  return requireEdit(owner, id)
}

/** Renames the frames group with it, one way (#729): the group is named
 *  after the edit, and a group renamed on Images leaves the edit alone. */
export async function renameEdit(owner: string, id: string, name: string) {
  name = nameSchema.parse(name)
  const edit = await requireEdit(owner, id)
  await sql`update edits set name = ${name}, updated_at = now()
    where id = ${id} and user_id = ${owner}`
  if (edit.group_id) {
    await sql`update image_groups set name = ${name}
      where id = ${edit.group_id} and user_id = ${owner}`
  }
}

/** Point the edit at the group its frames go in. Written once, by the first
 *  press of F; a later press finds it on the row. */
export async function setEditGroup(owner: string, id: string, groupId: string) {
  await requireEdit(owner, id)
  const rows = await sql`
    update edits set group_id = ${groupId}
    where id = ${id} and user_id = ${owner}
      and exists (select 1 from image_groups
                  where id = ${groupId} and user_id = ${owner})
    returning id
  `
  if (!rows.length) throw new Error('That group is not yours.')
}

/** The frames saved out of the edit, newest first: the live members of its
 *  group. Trashing loses `group_id`, so a trashed frame is simply not here. */
export async function listEditFrames(
  owner: string,
  groupId: string | null,
): Promise<Array<EditFrame>> {
  if (!groupId) return []
  return sql<Array<EditFrame>>`
    select id, title, to_json(created_at)#>>'{}' as created_at
    from user_images
    where user_id = ${owner} and group_id = ${groupId} and deleted_at is null
    order by created_at desc
  `
}

/**
 * Write the cut, if nothing else has since it was read.
 *
 * Ids are stored unchecked, as Director's are: one that resolves to nothing
 * drops out when the edit is next opened.
 */
export async function saveCut(
  owner: string,
  id: string,
  revision: number,
  clips: Array<CutClip>,
): Promise<Edit> {
  const cut = storedCutSchema.parse({ version: 1, clips })
  const rows = await sql`
    update edits set cut = ${jsonb(cut)}, revision = revision + 1, updated_at = now()
    where id = ${id} and user_id = ${owner} and revision = ${revision}
    returning id
  `
  if (!rows.length) {
    await requireEdit(owner, id)
    throw new Error('This edit changed in another tab. Reload before editing.')
  }
  return requireEdit(owner, id)
}

/** The clips are Video's and stay where they are. */
export async function deleteEdit(owner: string, id: string) {
  await sql`delete from edits where id = ${id} and user_id = ${owner}`
}
