'use server'

import {
  createEdit,
  deleteEdit,
  listEdits,
  renameEdit,
  saveCut,
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
