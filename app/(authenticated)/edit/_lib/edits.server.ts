import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  emptyCut,
  idSchema,
  nameSchema,
  parseCut,
  storedCutSchema,
} from './types'
import type { CutClip, Edit, EditSummary } from './types'
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
    select id, name, revision, cut, to_json(updated_at)#>>'{}' as updated_at
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

export async function renameEdit(owner: string, id: string, name: string) {
  name = nameSchema.parse(name)
  await requireEdit(owner, id)
  await sql`update edits set name = ${name}, updated_at = now()
    where id = ${id} and user_id = ${owner}`
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
