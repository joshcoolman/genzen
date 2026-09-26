'use server'

import { randomInt } from 'node:crypto'
import { generateVideo } from '../../video/_actions/generate-video.action'
import { genModel } from '../[id]/gen'
import { composeCast, composeShotPrompt, shotDuration } from '../_lib/rerun'
import { planCut, writeCast } from '../_lib/rerun.server'
import { collectSessionFrames } from '../_lib/references.server'
import {
  addPlannedCut,
  addSessionRefs,
  requireSession,
} from '../_lib/sessions.server'
import { idSchema } from '../_lib/types'
import type { Session } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/** Runs are 16:9, and a cut from script is a run. */
const CUT_RATIO = '16:9'

/**
 * New cut from script (#744): the open cut made again, properly, in one fast
 * pass, as a new cut beside it.
 *
 * Directing clip by clip is how a story is found and also why it drifts --
 * each clip is made knowing nothing of what follows. Once the story exists it
 * can be made the way a chat answer is: a prose cast, one planning call that
 * cuts the story into shots, every shot submitted at once on H3 Max Turbo with
 * one seed, so the film lands in about one clip's time. Prose continuity only:
 * no references and no drawn frames, which is what keeps it on the fast model.
 *
 * **The source is the story when the cut has one.** A cut made here stores the
 * story its planner extracted, and a later cut is planned from that plus the
 * prompts of any clips improvised onto it since -- never from the planner's
 * own polished prompts, because a copy of a copy drifts. A hand-built cut has
 * no story, and its prompts are the source.
 *
 * Settled rather than all-or-nothing, the chat's rule: a shot that failed to
 * submit has left a failed row behind, and the ones that went through are
 * already being made and paid for.
 */
export async function cutFromScript(sessionId: string): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  if (session.chat) throw new Error('A chat has one cut.')
  const source = session.cut
  if (source.clipIds.length === 0)
    throw new Error('This cut has no clips to make a script from.')

  const rows = await sql<
    Array<{ id: string; description: string | null; plan_cut: string | null }>
  >`
    select id, description,
      generation_metadata->'director_plan'->>'cut_id' as plan_cut
    from user_images
    where id = any(${source.clipIds}) and user_id = ${userId}
      and origin = 'director' and deleted_at is null
  `
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = source.clipIds.flatMap((id) => byId.get(id) ?? [])
  /* On a cut made here, only what was improvised onto it since: the rows the
     planner made are what `story` already says. */
  const improvised = source.story
    ? ordered.filter((row) => row.plan_cut !== source.id)
    : ordered
  const prompts = improvised.flatMap((row) =>
    row.description?.trim() ? [row.description.trim()] : [],
  )
  if (!source.story && prompts.length === 0)
    throw new Error('None of these clips has a prompt to read the story from.')

  /* The cast this cut was made with, when nothing has been added to it since:
     describing it again from its own stills is a copy of a copy. Otherwise
     one vision call over the stills, which are recorded on the session so
     they are trashed with it, as an extraction's are. */
  let cast = source.story && prompts.length === 0 ? source.cast : undefined
  if (!cast) {
    const frames = await collectSessionFrames(userId, source.clipIds)
    if (frames.length === 0)
      throw new Error(
        'No finished clips to read. Wait for the run to render, then try again.',
      )
    await addSessionRefs(
      userId,
      session.id,
      {},
      frames.map((frame) => frame.imageId),
    )
    const written = await writeCast({
      frames,
      prompts: ordered.flatMap((row) => row.description ?? []),
    })
    cast = composeCast(written.look, written.characters)
  }

  const plan = await planCut({
    cast,
    source: { story: source.story ?? null, prompts },
  })

  const model = genModel()
  const seed = randomInt(0, 2 ** 31)
  const submitted = await Promise.allSettled(
    plan.shots.map((shot) =>
      generateVideo({
        prompt: composeShotPrompt(cast, plan.scenes[shot.scene - 1], shot),
        duration: shotDuration(shot, model.durations),
        aspectRatio: CUT_RATIO,
        modelSlug: model.slug,
        origin: 'director',
        seed,
      }),
    ),
  )
  const landed = submitted.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [{ clipId: result.value.recordId, shot: index + 1 }]
      : [],
  )
  if (landed.length === 0) {
    const failed = submitted[0]
    throw failed.status === 'rejected' && failed.reason instanceof Error
      ? failed.reason
      : new Error('The cut could not be generated.')
  }

  return addPlannedCut(userId, session.id, {
    clipIds: landed.map((item) => item.clipId),
    shots: landed.map((item) => item.shot),
    story: plan.story,
    cast,
    seed,
    from: source.id,
  })
}
