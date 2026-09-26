'use server'

import {
  addCut,
  createSession,
  deleteCut,
  deleteSession,
  listSessions,
  openCut,
  renameSession,
  saveRun,
  trashSessionClips,
} from '../_lib/sessions.server'
import { idSchema } from '../_lib/types'
import type { SessionKind } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'

export async function loadSessions() {
  return listSessions((await resolveAuth()).userId)
}
export async function newSession(
  name: string,
  id: string,
  kind: SessionKind = 'run',
) {
  return createSession((await resolveAuth()).userId, name, id, kind)
}
export async function changeSessionName(id: string, name: string) {
  await renameSession((await resolveAuth()).userId, id, name)
}
export async function removeSession(id: string) {
  await deleteSession((await resolveAuth()).userId, idSchema.parse(id))
}
/** One cut's run, as the workspace has it. Returns the session so the caller
 *  holds the revision its next write has to match. */
export async function writeRun(
  id: string,
  revision: number,
  clipIds: Array<string>,
  cutId: string,
) {
  return saveRun(
    (await resolveAuth()).userId,
    idSchema.parse(id),
    revision,
    clipIds,
    cutId,
  )
}
/** The cut tabs (#744). Each returns the session as written. */
export async function newCut(id: string) {
  return addCut((await resolveAuth()).userId, idSchema.parse(id))
}
export async function switchCut(id: string, cutId: string) {
  return openCut((await resolveAuth()).userId, idSchema.parse(id), cutId)
}
export async function removeCut(id: string, cutId: string) {
  return deleteCut((await resolveAuth()).userId, idSchema.parse(id), cutId)
}
/** Trash a clip the session made, because it left the run (#679). */
export async function trashClip(id: string) {
  await trashSessionClips((await resolveAuth()).userId, [idSchema.parse(id)])
}
