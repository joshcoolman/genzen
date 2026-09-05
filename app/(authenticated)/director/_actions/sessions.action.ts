'use server'

import { z } from 'zod'
import { settingsSchema } from '../clips'
import { readReceipt } from '../clip-jobs.server'
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  renameSession,
  requireSession,
  saveDraft,
  saveState,
} from '../_lib/sessions.server'
import { idSchema, storedCutSchema } from '../_lib/types'
import type { Settings } from '../clips'
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
export async function writeDraft(id: string, draft: string, previous: string) {
  await saveDraft(
    (await resolveAuth()).userId,
    id,
    z.string().max(2000).parse(draft),
    previous,
  )
}
export async function updateSettings(
  id: string,
  revision: number,
  settings: Settings,
) {
  const owner = (await resolveAuth()).userId
  const session = await requireSession(owner, id)
  if (session.cut.pending) throw new Error('Resolve the pending request first.')
  return saveState(
    owner,
    { ...session, revision },
    { ...session.cut, settings: settingsSchema.parse(settings) },
  )
}
export async function updateOpening(
  id: string,
  revision: number,
  mediaId: string | null,
) {
  const owner = (await resolveAuth()).userId
  const session = await requireSession(owner, id)
  if (session.cut.pending || session.cut.clips.length)
    throw new Error('The opening image cannot change after generation starts.')
  return saveState(
    owner,
    { ...session, revision },
    { ...session.cut, initialImage: idSchema.nullable().parse(mediaId) },
  )
}
export async function importCut(id: string, input: unknown, draft: string) {
  const owner = (await resolveAuth()).userId
  const session = await requireSession(owner, id)
  const cut = storedCutSchema.parse(input)
  // Only an empty session is an import target; a repeated finish is harmless.
  if (session.revision > 0) {
    if (JSON.stringify(session.cut) === JSON.stringify(cut)) return session
    throw new Error(
      'This session already contains work. Import into a new session.',
    )
  }
  if (cut.pending?.token) readReceipt(cut.pending.token, owner)
  return saveState(owner, session, cut, z.string().max(2000).parse(draft))
}
