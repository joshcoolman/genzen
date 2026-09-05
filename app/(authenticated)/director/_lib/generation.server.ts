import 'server-only'
import { z } from 'zod'
import { checkClip, submitClip } from '../../lab/director/_actions/clips.action'
import { clipResult, readReceipt } from '../../lab/director/clip-jobs.server'
import { requireSession, saveState } from './sessions.server'
import { readMedia } from './media.server'
import { ingestVideo } from './ingest.server'
import { idSchema } from './types'
import { falFetch } from '#/lib/server/fal-fetch.server'
import { first, jsonb, sql } from '#/lib/server/db.server'

const processing = new Set<string>()
export async function beginGeneration(
  owner: string,
  id: string,
  revision: number,
  requestId: string,
  prompt: string,
  redo: boolean,
) {
  idSchema.parse(requestId)
  prompt = z.string().trim().min(1).max(2000).parse(prompt)
  z.boolean().parse(redo)
  const session = await requireSession(owner, id)
  const existing = first(
    await sql`select id from director_requests
    where id = ${requestId} and session_id = ${id} and user_id = ${owner}`,
  )
  if (existing) return session
  if (session.cut.pending) throw new Error('Resolve the pending request first.')
  if (redo && (!session.cut.clips.length || session.cut.clips.at(-1)?.imported))
    throw new Error('This section cannot be redone.')
  const preceding = redo ? session.cut.clips.slice(0, -1) : session.cut.clips
  if (preceding.length >= 50)
    throw new Error('A session supports up to 50 sections.')
  const pending = {
    id: requestId,
    prompt,
    context: preceding.map((clip) => clip.prompt),
    settings: session.cut.settings,
    redo,
    startedAt: Date.now(),
  }
  await sql.begin(async (tx) => {
    const changed = await tx`update director_sessions
      set cut = ${jsonb({ ...session.cut, pending })}, revision = revision + 1, updated_at = now()
      where id = ${id} and user_id = ${owner} and revision = ${revision} returning id`
    if (!changed.length)
      throw new Error(
        'This session changed in another tab. Reload before editing.',
      )
    await tx`insert into director_requests (id, session_id, user_id)
      values (${requestId}, ${id}, ${owner})`
  })
  const reserved = await requireSession(owner, id)
  const data = new FormData()
  data.set(
    'request',
    JSON.stringify({
      prompt,
      context: pending.context,
      settings: pending.settings,
    }),
  )
  const imageId = preceding.at(-1)?.endFrameId ?? session.cut.initialImage
  if (imageId)
    data.set('frame', await readMedia(owner, imageId), 'starting-frame.png')
  // This server call returns the receipt before it crosses the browser's
  // connection. A lost browser response can be recovered from the session.
  const token = await submitClip(data)
  await sql`update director_requests set token = ${token}
    where id = ${requestId} and session_id = ${id} and user_id = ${owner}`
  return saveState(owner, reserved, {
    ...reserved.cut,
    pending: { ...pending, token },
  })
}

export async function recoverGeneration(owner: string, id: string) {
  const session = await requireSession(owner, id)
  let pending = session.cut.pending
  if (!pending || processing.has(id)) return session
  if (!pending.token) {
    const accepted = first(
      await sql<
        Array<{ token: string | null }>
      >`select token from director_requests
      where id = ${pending.id} and session_id = ${id} and user_id = ${owner}`,
    )
    if (!accepted?.token) return session
    pending = { ...pending, token: accepted.token }
  }
  const token = pending.token!
  processing.add(id)
  try {
    if ((await checkClip(token)) !== 'COMPLETED')
      return { ...session, cut: { ...session.cut, pending } }
    const receipt = readReceipt(token, owner)
    const response = await falFetch(await clipResult(receipt), {
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok)
      throw new Error(
        'Could not download this generation. Check the existing request again.',
      )
    const blob = await response.blob()
    if (!blob.size || blob.size > 100 * 1024 * 1024)
      throw new Error('Unexpected clip size.')
    const media = await ingestVideo(
      owner,
      id,
      new Blob([blob], { type: 'video/mp4' }),
    )
    const latest = await requireSession(owner, id)
    if (latest.cut.pending?.id !== pending.id) return latest
    const clip = {
      ...media,
      id: pending.id,
      prompt: pending.prompt,
      model: pending.settings.model,
      elapsedMs: Date.now() - pending.startedAt,
    }
    const clips = pending.redo
      ? [...latest.cut.clips.slice(0, -1), clip]
      : [...latest.cut.clips, clip]
    return saveState(owner, latest, { ...latest.cut, clips, pending: null })
  } finally {
    processing.delete(id)
  }
}
export async function dismissGeneration(
  owner: string,
  id: string,
  revision: number,
) {
  if (processing.has(id))
    throw new Error('This request is being saved. Please wait.')
  const session = await requireSession(owner, id)
  return saveState(
    owner,
    { ...session, revision },
    { ...session.cut, pending: null },
  )
}
