'use server'

import {
  cancelCutJob,
  checkpoint,
  createCutJob,
  readCutJob,
  retryCutJob,
} from '../_lib/cut-job.server'
import { requireSession } from '../_lib/sessions.server'
import { idSchema } from '../_lib/types'
import { first, sql } from '#/lib/server/db.server'
import { resolveAuth } from '#/lib/server/auth.server'

export async function cutFromScript(sessionId: string, direction = '') {
  return createCutJob(
    (await resolveAuth()).userId,
    idSchema.parse(sessionId),
    direction,
  )
}

export async function cancelScriptCut(sessionId: string, cutId: string) {
  const { userId } = await resolveAuth()
  const job = await readCutJob(userId, idSchema.parse(cutId))
  if (job?.session_id !== idSchema.parse(sessionId))
    throw new Error('Cut not found.')
  await cancelCutJob(userId, cutId)
  return requireSession(userId, sessionId)
}

export async function retryScriptCut(sessionId: string, cutId: string) {
  const { userId } = await resolveAuth()
  const job = await readCutJob(userId, idSchema.parse(cutId))
  if (job?.session_id !== idSchema.parse(sessionId))
    throw new Error('Cut not found.')
  await retryCutJob(userId, cutId)
  return requireSession(userId, sessionId)
}

/** Editing a waiting line shares the worker lock, so its next checkpoint cannot
 * overwrite the correction with a stale plan. */
export async function changeCutPronunciation(
  sessionId: string,
  cutId: string,
  clipId: string,
  spoken: string,
) {
  const { userId } = await resolveAuth()
  idSchema.parse(sessionId)
  idSchema.parse(cutId)
  idSchema.parse(clipId)
  if (typeof spoken !== 'string' || spoken.length > 4000)
    throw new Error('The spoken line is too long.')
  const connection = await sql.reserve()
  let locked = false
  try {
    const lock = first(
      await connection<Array<{ locked: boolean }>>`
      select pg_try_advisory_lock(hashtextextended(${`director-cut:${cutId}`}, 0)) as locked
    `,
    )
    locked = lock?.locked ?? false
    if (!locked)
      throw new Error('The cut is updating. Try saving again in a moment.')
    const job = await readCutJob(userId, cutId)
    if (
      !job ||
      job.session_id !== sessionId ||
      job.status !== 'active' ||
      job.data.phase !== 'generate'
    )
      throw new Error(
        'Pronunciation can be changed for clips still waiting to generate.',
      )
    const shot = job.data.shots.find((item) => item.id === clipId)
    if (!shot || shot.state !== 'waiting')
      throw new Error('That clip has already started.')
    shot.spokenOverride =
      spoken.trim() && spoken.trim() !== shot.spoken ? spoken.trim() : null
    if (!(await checkpoint(job)))
      throw new Error('The cut changed. Reload before saving.')
  } finally {
    try {
      if (locked)
        await connection`select pg_advisory_unlock(hashtextextended(${`director-cut:${cutId}`}, 0))`
    } finally {
      connection.release()
    }
  }
}
