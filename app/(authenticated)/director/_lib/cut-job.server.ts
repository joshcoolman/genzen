import 'server-only'
import { randomInt, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { nextCutName, parseCuts } from './types'
import { requireSession } from './sessions.server'
import type { CutJob, CutJobData } from './cut-job'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { cancelFalRequest } from '#/lib/server/fal-cancel.server'

export async function readCutJob(owner: string, cutId: string) {
  return first(
    await sql<Array<CutJob>>`
    select id, user_id, session_id, status, data, error, version from director_cut_jobs
    where id = ${cutId} and user_id = ${owner}
  `,
  )
}

/** Snapshot the source, then open the new cut before any slow or paid work. */
export async function createCutJob(
  owner: string,
  sessionId: string,
  direction: string,
) {
  direction = z.string().trim().max(4000).parse(direction)
  const session = await requireSession(owner, sessionId)
  if (session.chat) throw new Error('A chat has one cut.')
  const source = session.cut
  if (!source.clipIds.length) throw new Error('This cut has no clips to read.')
  if (session.generation && session.generation.status !== 'completed')
    throw new Error('Finish this cut before making another from it.')
  const rows = await sql<
    Array<{ id: string; description: string | null; plan_cut: string | null }>
  >`
    select id, description, generation_metadata->'director_plan'->>'cut_id' as plan_cut
    from user_images where user_id = ${owner} and id = any(${source.clipIds})
      and origin = 'director' and deleted_at is null and status = 'completed'
  `
  if (rows.length !== source.clipIds.length)
    throw new Error('Wait for this cut’s clips to finish first.')
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = source.clipIds.flatMap((id) => byId.get(id) ?? [])
  const prompts = ordered
    .filter((row) => !source.story || row.plan_cut !== source.id)
    .flatMap((row) => (row.description?.trim() ? [row.description.trim()] : []))
  if (!source.story && !prompts.length)
    throw new Error('This cut has no script to read.')
  const id = randomUUID()
  const data: CutJobData = {
    direction,
    source: {
      id: source.id,
      clipIds: source.clipIds,
      story: source.story ?? null,
      cast: source.cast ?? null,
      prompts,
      allPrompts: ordered.flatMap((row) => row.description ?? []),
    },
    phase: 'cast',
    cast: null,
    story: null,
    scenes: [],
    shots: [],
    seed: randomInt(0, 2 ** 31),
    index: 0,
  }
  await sql.begin(async (tx) => {
    const cut = {
      id,
      name: nextCutName(session.cuts),
      clipIds: [],
      from: source.id,
    }
    if (session.cuts.cuts.length >= 20)
      throw new Error('A session can hold at most 20 cuts.')
    const changed = await tx`
      update director_sessions set cut = ${jsonb({ ...session.cuts, active: id, cuts: [...session.cuts.cuts, cut] })},
        revision = revision + 1, updated_at = now()
      where id = ${sessionId} and user_id = ${owner} and revision = ${session.revision}
      returning id
    `
    if (!changed.length)
      throw new Error('The source changed. Reload before starting the cut.')
    await tx`insert into director_cut_jobs (id, user_id, session_id, data)
      values (${id}, ${owner}, ${sessionId}, ${jsonb(data)})`
  })
  return requireSession(owner, sessionId)
}

/** Only the worker may checkpoint active work. A cancel wins against late responses. */
export async function checkpoint(job: CutJob): Promise<boolean> {
  const rows = await sql`
    update director_cut_jobs set data = ${jsonb(job.data)}, version = version + 1, updated_at = now()
    where id = ${job.id} and user_id = ${job.user_id} and status = 'active' and version = ${job.version}
    returning id
  `
  if (rows.length) job.version++
  return rows.length > 0
}

export async function jobIsActive(job: CutJob) {
  const row = await readCutJob(job.user_id, job.id)
  return row?.status === 'active'
}

/** Planning commits placeholders and cut metadata atomically, without selecting the tab again. */
export async function saveCutPlan(job: CutJob, descriptions: Array<string>) {
  await sql.begin(async (tx) => {
    const current = first(
      await tx<Array<{ status: string; version: number }>>`
      select status, version from director_cut_jobs where id = ${job.id} and user_id = ${job.user_id} for update
    `,
    )
    if (current?.status !== 'active' || current.version !== job.version) return
    const session = first(
      await tx<Array<{ cut: unknown }>>`
      select cut from director_sessions where id = ${job.session_id} and user_id = ${job.user_id} for update
    `,
    )
    if (!session) return
    const cuts = parseCuts(session.cut, job.session_id)
    if (!cuts.cuts.some((c) => c.id === job.id)) {
      await tx`update director_cut_jobs set status = 'cancelled', version = version + 1, updated_at = now()
        where id = ${job.id} and user_id = ${job.user_id}`
      return
    }
    for (const [index, shot] of job.data.shots.entries()) {
      await tx`insert into user_images (id, user_id, title, description, source, origin, status, generation_metadata)
        values (${shot.id}, ${job.user_id}, ${`Clip ${index + 1}`}, ${descriptions[index]},
          'ai_video', 'director', 'pending', ${jsonb({
            director_queue: true,
            director_plan: { cut_id: job.id, shot: index + 1 },
            canonical_prompt: descriptions[index],
            canonical_dialogue: shot.spoken,
            duration_seconds: shot.duration,
            aspect_ratio: '16:9',
          })})`
    }
    const updated = {
      ...cuts,
      cuts: cuts.cuts.map((c) =>
        c.id === job.id
          ? {
              ...c,
              clipIds: job.data.shots.map((s) => s.id),
              story: job.data.story,
              cast: job.data.cast,
              seed: job.data.seed,
            }
          : c,
      ),
    }
    await tx`update director_sessions set cut = ${jsonb(updated)}, revision = revision + 1, updated_at = now()
      where id = ${job.session_id} and user_id = ${job.user_id}`
    await tx`update director_cut_jobs set data = ${jsonb(job.data)}, version = version + 1, updated_at = now()
      where id = ${job.id} and user_id = ${job.user_id} and status = 'active'`
  })
}

export async function cancelCutJob(owner: string, cutId: string) {
  const job = first(
    await sql<Array<CutJob>>`
    update director_cut_jobs set status = 'cancelled', version = version + 1, updated_at = now()
    where id = ${cutId} and user_id = ${owner} and status in ('active', 'failed', 'blocked')
    returning id, user_id, session_id, status, data, error, version
  `,
  )
  if (!job) return
  // Do not await the provider before recording the user's cancellation.
  for (const shot of job.data.shots) {
    if (shot.state === 'generating' && shot.requestId && shot.endpoint)
      await cancelFalRequest(shot.requestId, { fal_model_id: shot.endpoint })
  }
  await sql`update user_images set status = 'failed', generation_error = 'Cut cancelled'
    where user_id = ${owner} and id = any(${job.data.shots.map((s) => s.id)}) and status = 'pending'`
}

export async function retryCutJob(owner: string, cutId: string) {
  const job = await readCutJob(owner, cutId)
  if (!job || job.status !== 'failed')
    throw new Error('This cut cannot be retried automatically.')
  // Transient failures retry the same receipt. Only a confirmed provider refusal
  // can authorize a fresh paid request, and only on this explicit Retry press.
  const shot = job.data.shots.at(job.data.index)
  const rejected = shot?.rejected ?? false
  if (shot && rejected) {
    shot.state = 'waiting'
    delete shot.requestId
    delete shot.submittedAt
    delete shot.rejected
  }
  // Publish the resumable job and its media status together: a worker must not
  // finish the receipt between these writes and have its result reset to pending.
  await sql.begin(async (tx) => {
    const changed =
      await tx`update director_cut_jobs set status = 'active', error = null,
        data = ${jsonb(job.data)}, version = version + 1, updated_at = now()
      where id = ${cutId} and user_id = ${owner} and status = 'failed' and version = ${job.version}
      returning id`
    if (changed.length && shot)
      await tx`update user_images set status = 'pending', generation_error = null,
        request_id = case when ${rejected} then null else request_id end
      where id = ${shot.id} and user_id = ${owner}`
  })
}
