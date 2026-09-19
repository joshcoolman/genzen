'use server'

import {
  createSession,
  deleteSession,
  listSessions,
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
/** The run, as the workspace has it. Returns the session so the caller holds
 *  the revision its next write has to match. */
export async function writeRun(
  id: string,
  revision: number,
  clipIds: Array<string>,
) {
  return saveRun(
    (await resolveAuth()).userId,
    idSchema.parse(id),
    revision,
    clipIds,
  )
}
/** Trash a clip the session made, because it left the run (#679). */
export async function trashClip(id: string) {
  await trashSessionClips((await resolveAuth()).userId, [idSchema.parse(id)])
}
