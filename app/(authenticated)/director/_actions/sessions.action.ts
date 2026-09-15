'use server'

import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  renameSession,
  saveRun,
} from '../_lib/sessions.server'
import { idSchema } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'

export async function loadSession(id: string) {
  return getSession((await resolveAuth()).userId, id)
}
export async function loadSessions() {
  return listSessions((await resolveAuth()).userId)
}
export async function newSession(name: string, id: string) {
  return createSession((await resolveAuth()).userId, name, id)
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
