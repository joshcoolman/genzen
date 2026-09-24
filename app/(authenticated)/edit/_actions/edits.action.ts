'use server'

import {
  createEdit,
  deleteEdit,
  listEditFrames,
  listEdits,
  renameEdit,
  requireEdit,
  saveCut,
  setEditGroup,
} from '../_lib/edits.server'
import { idSchema } from '../_lib/types'
import type { CutClip } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'

export async function loadEdits() {
  return listEdits((await resolveAuth()).userId)
}
export async function newEdit(name: string, id: string) {
  return createEdit((await resolveAuth()).userId, name, id)
}
export async function changeEditName(id: string, name: string) {
  await renameEdit((await resolveAuth()).userId, id, name)
}
export async function removeEdit(id: string) {
  await deleteEdit((await resolveAuth()).userId, idSchema.parse(id))
}
/** Attach the frames group (#729). */
export async function attachFramesGroup(id: string, groupId: string) {
  await setEditGroup(
    (await resolveAuth()).userId,
    idSchema.parse(id),
    idSchema.parse(groupId),
  )
}
/** The frames saved out of this edit, as they stand. */
export async function loadFrames(id: string) {
  const { userId } = await resolveAuth()
  const edit = await requireEdit(userId, idSchema.parse(id))
  return listEditFrames(userId, edit.group_id)
}
/** The cut, as the workspace has it. Returns the edit so the caller holds the
 *  revision its next write has to match. */
export async function writeCut(
  id: string,
  revision: number,
  clips: Array<CutClip>,
) {
  return saveCut(
    (await resolveAuth()).userId,
    idSchema.parse(id),
    revision,
    clips,
  )
}
