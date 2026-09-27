import 'server-only'
import { randomUUID } from 'node:crypto'
import { genModel } from '../[id]/gen'
import { composeCast, composeShotPrompt, shotDuration } from './rerun'
import { planCut, writeCast } from './rerun.server'
import { pronounceLines } from './storyboard.server'
import { collectSessionFrames } from './references.server'
import { addSessionRefs } from './sessions.server'
import {
  checkpoint,
  jobIsActive,
  readCutJob,
  saveCutPlan,
} from './cut-job.server'
import { continuityFrame } from './cut-frame.server'
import type { CutJob } from './cut-job'
import type { VideoImageInput } from '#/features/video/inputs'
import { videoFalInput, videoRequestPlan } from '#/features/video/inputs'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { fal, submitFalOnce } from '#/lib/server/fal-client.server'
import { uploadLibraryImagesToFal } from '#/lib/server/fal-image-inputs.server'
import { processVideoResult } from '#/lib/server/fal-completion.server'
import { isFalRejection } from '#/lib/server/fal-error.server'
import { cancelFalRequest } from '#/lib/server/fal-cancel.server'

const POLL_MS = 3000

/** Each invocation performs one checkpointed stage. No browser request drives it. */
export async function advanceCutJob(job: CutJob, signal?: AbortSignal) {
  if (!(await jobIsActive(job))) return
  const d = job.data
  if (d.phase === 'cast') {
    if (
      !d.direction &&
      d.source.cast &&
      d.source.story &&
      !d.source.prompts.length
    ) {
      d.cast = d.source.cast
    } else {
      const frames = await collectSessionFrames(job.user_id, d.source.clipIds)
      if (!(await jobIsActive(job))) return
      if (!frames.length)
        throw new Error('No finished source frames could be read.')
      await addSessionRefs(
        job.user_id,
        job.session_id,
        {},
        frames.map((f) => f.imageId),
      )
      const cast = await writeCast({
        frames,
        prompts: d.source.allPrompts,
        direction: d.direction,
        signal,
      })
      d.cast = composeCast(cast.look, cast.characters)
      if (d.cast.length > 8000)
        throw new Error(
          'The appearance descriptions are too long. Retry planning.',
        )
    }
    d.phase = 'plan'
    await checkpoint(job)
    return
  }
  if (d.phase === 'plan') {
    const plan = await planCut({
      cast: d.cast!,
      source: d.source,
      direction: d.direction,
      signal,
    })
    if (!(await jobIsActive(job))) return
    d.story = plan.story
    d.scenes = plan.scenes
    d.shots = plan.shots.map((shot) => ({
      ...shot,
      id: randomUUID(),
      duration: shotDuration(shot, genModel().durations),
      spokenOverride: null,
      state: 'waiting',
    }))
    d.phase = 'pronounce'
    await saveCutPlan(
      job,
      d.shots.map((shot) =>
        composeShotPrompt(d.cast!, d.scenes[shot.scene - 1], shot),
      ),
    )
    return
  }
  if (d.phase === 'pronounce') {
    const spoken = await pronounceLines(
      d.shots.flatMap((shot, index) =>
        shot.spoken.trim() ? [{ number: index + 1, line: shot.spoken }] : [],
      ),
      signal,
    )
    d.shots.forEach((shot, index) => {
      shot.spokenOverride = spoken.get(index + 1) ?? null
    })
    d.phase = 'generate'
    await checkpoint(job)
    return
  }
  const shot = d.shots.at(d.index)
  if (!shot) {
    await finishCutJob(job)
    return
  }
  const row = first(
    await sql<
      Array<{ status: string; request_id: string | null; deleted_at: unknown }>
    >`
    select status, request_id, deleted_at from user_images
    where id = ${shot.id} and user_id = ${job.user_id}
  `,
  )
  if (!row || row.deleted_at)
    throw new Error('A planned clip was removed. Cancel this cut.')
  if (shot.state === 'submitting') {
    // A process died after intent was saved. A receipt is safe to poll; no receipt
    // is ambiguous, and may already have spent money. Never automatically POST again.
    if (row.request_id) {
      shot.requestId = row.request_id
      shot.state = 'generating'
      await checkpoint(job)
    } else {
      await sql`update director_cut_jobs set status = 'blocked',
        error = 'The provider may have accepted this clip, but no receipt was saved. Check Activity and the provider before starting another cut.',
        updated_at = now() where id = ${job.id} and user_id = ${job.user_id} and status = 'active' and version = ${job.version}`
    }
    return
  }
  if (shot.state === 'generating') {
    if (row.status !== 'completed') {
      if (!shot.requestId || !shot.endpoint)
        throw new Error('The clip has no provider receipt.')
      const status = await fal.queue.status(shot.endpoint, {
        requestId: shot.requestId,
      })
      if (status.status !== 'COMPLETED') {
        if (
          shot.submittedAt &&
          Date.now() - Date.parse(shot.submittedAt) > 30 * 60 * 1000
        )
          throw new Error(
            'This clip is taking longer than expected. Retry to check the existing request.',
          )
        return
      }
      const result = await fal.queue.result(shot.endpoint, {
        requestId: shot.requestId,
      })
      if (!(await jobIsActive(job))) return
      await processVideoResult(
        shot.id,
        job.user_id,
        result.data as Record<string, unknown>,
      )
    }
    if (!(await jobIsActive(job))) return
    shot.state = 'completed'
    d.index++
    if ((await checkpoint(job)) && d.index === d.shots.length)
      await finishCutJob(job)
    return
  }
  if (shot.state === 'completed') {
    d.index++
    await checkpoint(job)
    return
  }
  shot.state = 'preparing'
  if (!(await checkpoint(job))) return
  if (d.index > 0) {
    const previous = d.shots[d.index - 1]
    if (previous.state !== 'completed')
      throw new Error('The previous clip is not ready.')
    shot.frameId = await continuityFrame(job.user_id, previous.id)
    if (!(await jobIsActive(job))) return
    await addSessionRefs(job.user_id, job.session_id, {}, [shot.frameId])
  }
  if (!(await jobIsActive(job))) return
  const images: Array<VideoImageInput> = shot.frameId
    ? [{ id: shot.frameId, role: 'first' }]
    : []
  const model = genModel()
  const prompt = composeShotPrompt(d.cast!, d.scenes[shot.scene - 1], {
    ...shot,
    spoken: shot.spokenOverride ?? shot.spoken,
  })
  const plan = videoRequestPlan(model, images, prompt, shot.duration, '16:9')
  const uploaded = await uploadLibraryImagesToFal(
    images.map((i) => i.id),
    job.user_id,
  )
  shot.endpoint = plan.endpoint.id
  shot.state = 'submitting'
  shot.submittedAt = new Date().toISOString()
  // The atomic checkpoint claims this dispatch against Cancel; a request already
  // claimed can race cancellation, but is cancelled when its receipt arrives.
  if (!(await checkpoint(job))) return
  await sql`update user_images set generation_metadata = coalesce(generation_metadata, '{}'::jsonb) ||
    ${jsonb({
      prompt,
      model_label: model.label,
      model: plan.endpoint.id,
      fal_model_id: plan.endpoint.id,
      input_images: images,
      source_image_id: shot.frameId ?? null,
      spoken_override: shot.spokenOverride,
      estimated_cost_cents: plan.estimatedCostCents,
      duration_seconds: shot.duration,
      generation_type: images.length ? 'image_to_video' : 'text_to_video',
      seed: d.seed,
      submitted_at: shot.submittedAt,
    })}
    where id = ${shot.id} and user_id = ${job.user_id}`
  if (!(await jobIsActive(job))) return
  const requestId = await submitFalOnce(
    plan.endpoint.id,
    videoFalInput(plan.endpoint, images, uploaded, {
      prompt,
      duration: shot.duration,
      aspectRatio: '16:9',
      resolution: plan.resolution,
      supportsAudio: model.supportsAudio,
      generateAudio: true,
      seed: d.seed,
    }),
  )
  // Save the receipt even if Cancel happened while POST was in flight.
  await sql`update user_images set request_id = ${requestId}
    where id = ${shot.id} and user_id = ${job.user_id}`
  shot.requestId = requestId
  shot.state = 'generating'
  if (!(await checkpoint(job)))
    await cancelFalRequest(requestId, { fal_model_id: shot.endpoint })
}

async function finishCutJob(job: CutJob) {
  await sql`update director_cut_jobs set status = 'completed', updated_at = now()
    where id = ${job.id} and user_id = ${job.user_id} and status = 'active' and version = ${job.version}`
}

/** A reserved connection holds a session advisory lock across async work. Unlike
 * a timed lease it cannot expire beneath a slow worker and start a second POST. */
export async function runCutJob(owner: string, id: string) {
  const connection = await sql.reserve()
  let locked = false
  let timer: ReturnType<typeof setInterval> | undefined
  try {
    const lock = first(
      await connection<Array<{ locked: boolean }>>`
      select pg_try_advisory_lock(hashtextextended(${`director-cut:${id}`}, 0)) as locked
    `,
    )
    locked = lock?.locked ?? false
    if (!locked) return
    const job = await readCutJob(owner, id)
    if (!job || job.status !== 'active') return
    const controller = new AbortController()
    timer = setInterval(() => {
      void jobIsActive(job)
        .then((active) => {
          if (!active) controller.abort()
        })
        .catch(() => controller.abort())
    }, 1000)
    timer.unref()
    try {
      await advanceCutJob(
        job,
        AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]),
      )
    } catch (cause) {
      const shot = job.data.shots.at(job.data.index)
      if (shot?.state === 'generating' && isFalRejection(cause)) {
        shot.rejected = true
        await checkpoint(job)
      }
      const ambiguous =
        job.data.shots.at(job.data.index)?.state === 'submitting'
      const message = ambiguous
        ? 'Submission was interrupted. The provider may have accepted it; check Activity and the provider before starting another cut.'
        : cause instanceof Error
          ? cause.message
          : 'The cut could not continue.'
      const failed =
        await sql`update director_cut_jobs set status = ${ambiguous ? 'blocked' : 'failed'},
        error = ${message}, updated_at = now()
        where id = ${id} and user_id = ${owner} and status = 'active' and version = ${job.version} returning id`
      if (failed.length && shot)
        await sql`update user_images set status = 'failed', generation_error = ${message}
        where id = ${shot.id} and user_id = ${owner} and status = 'pending'`
    }
  } finally {
    if (timer) clearInterval(timer)
    try {
      if (locked)
        await connection`select pg_advisory_unlock(hashtextextended(${`director-cut:${id}`}, 0))`
    } finally {
      connection.release()
    }
  }
}

/** Starts once per Node server; persisted checkpoints survive process restarts.
 * At most two jobs per process so the normal request pool always has headroom. */
export function startCutWorker() {
  const global = globalThis as typeof globalThis & {
    directorCutWorker?: boolean
  }
  if (global.directorCutWorker) return
  global.directorCutWorker = true
  const tick = async () => {
    try {
      // sql-scope-exempt: trusted scheduler discovers owners; every subsequent read/write scopes to that owner.
      const jobs = await sql<Array<{ id: string; user_id: string }>>`
        select id, user_id from director_cut_jobs where status = 'active' order by updated_at limit 2
      `
      const results = await Promise.allSettled(
        jobs.map((job) => runCutJob(job.user_id, job.id)),
      )
      for (const result of results)
        if (result.status === 'rejected')
          console.error(
            '[director-worker] tick failed',
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error',
          )
    } catch (cause) {
      console.error(
        '[director-worker]',
        cause instanceof Error ? cause.message : 'Worker failed',
      )
    } finally {
      setTimeout(() => void tick(), POLL_MS).unref()
    }
  }
  setTimeout(() => void tick(), POLL_MS).unref()
}
