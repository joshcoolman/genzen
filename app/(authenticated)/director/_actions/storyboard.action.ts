'use server'

import { randomUUID } from 'node:crypto'
import {
  FRAME_MODEL_SLUG,
  FRAME_RATIO,
  RERUN_MODEL_SLUGS,
  SECTION_MODEL_SLUG,
  SECTION_RATIO,
  assembleScenes,
  closingReferenceIds,
  lineToSpeak,
  sceneReferenceIds,
  sectionDuration,
  spokenOf,
} from '../[id]/board'
import { dialogueOf } from '../[id]/script'
import {
  requireSession,
  saveBoard,
  trashSessionClips,
  updateBoardScene,
} from '../_lib/sessions.server'
import { planStoryboard, pronounceLines } from '../_lib/storyboard.server'
import { boardImageIds, idSchema } from '../_lib/types'
import {
  generateVideo,
  listVideos,
} from '../../video/_actions/generate-video.action'
import { listSessionRefs } from './references.action'
import type { RefAsset } from './references.action'
import type { BoardScene, Session } from '../_lib/types'
import closeFramePrompt from '#/lib/prompts/director-frame-close.md'
import openFramePrompt from '#/lib/prompts/director-frame-open.md'
import sectionPrompt from '#/lib/prompts/director-section.md'
import { generateImageInternal } from '#/features/ai-images/server/generate-image-internal.server'
import { updateImageMeta } from '#/features/user-images/server/images.action'
import { fal } from '#/lib/server/fal-client.server'
import { extractFalError, isFalRejection } from '#/lib/server/fal-error.server'
import {
  markGenerationFailedWithBlob,
  processVideoResult,
} from '#/lib/server/fal-completion.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

/**
 * The storyboard tab (#695): a first and last frame for every scene, before any
 * video.
 *
 * Twelve images at 8c answer the question a $38 video pass answers -- does the
 * script, the character sheet and the location sheets add up to a story you
 * want to watch. Nothing here generates video and nothing is wired to what
 * comes after it.
 *
 * **A scene is a numbered script line**, and its two frames are the ends of
 * the video section that line will become -- so the board is one row per clip
 * and its numbers are the run's numbers.
 *
 * **Two stages, and that is forced rather than chosen.** The closing frame is
 * generated *from* the scene's opening frame, and a reference is bytes out of
 * the bucket -- there is nothing behind a pending row to upload. So Create
 * storyboard plans the scenes and submits every opening at once, and
 * `closeScene` is called per scene by the page as each opening lands. The
 * frames chain no further than that on purpose: judge the cuts between scenes
 * first, and chain scene to scene once there is something to judge.
 */

/** The rows a storyboard has made -- both frames of every scene and every take
 *  of it -- read as they are now, so the tab draws pending, failed and finished
 *  off the row like every other generation. */
export async function listBoardFrames(
  sessionId: string,
): Promise<Record<string, RefAsset>> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  /* `boardImageIds`, not a flatMap written again here. The takes have to be in
     this list -- the tab reads every tile's state off it, and `frameState`
     treats an id it cannot find as one still being made, so a take left out
     renders as "working" for ever whatever it actually did. That is exactly
     what happened: this function kept its own copy of "every row the board
     owns", the copy was not updated when takes were added, and a finished take
     and a missing one looked identical on screen. One definition now, shared
     with the trash sweep. */
  const ids = boardImageIds(session.board)
  if (ids.length === 0) return {}
  const rows = await sql<Array<RefAsset>>`
    select id, title, description, status, generation_error,
           to_json(created_at)#>>'{}' as created_at
    from user_images
    where user_id = ${userId}
      and id = any(${ids})
      and origin = 'director'
      and deleted_at is null
  `
  return Object.fromEntries(rows.map((row) => [row.id, row]))
}

/** The sheets a scene is generated from, as the planner and the generations
 *  both want them: finished only, because a pending sheet is neither something
 *  to plan around nor bytes anything can reference. */
async function sheetsOf(sessionId: string) {
  const refs = await listSessionRefs(sessionId)
  const done = (list: Array<RefAsset>) =>
    list
      .filter((asset) => asset.status === 'completed')
      .map((asset) => ({
        id: asset.id,
        title: asset.title,
        description: asset.description,
      }))
  return { characters: done(refs.characters), locations: done(refs.locations) }
}

/** Submit one frame. The prompt is the fixed instruction plus what this frame
 *  is of; the row is named for its place in the script, which is the one thing
 *  that identifies it outside the board. */
async function submitFrame({
  instruction,
  scene,
  words,
  referenceImageIds,
  model,
  label,
}: {
  instruction: string
  scene: BoardScene
  words: string
  referenceImageIds: Array<string>
  model: string
  label: 'Opening' | 'Closing'
}): Promise<string> {
  const { recordId } = await generateImageInternal({
    prompt: `${instruction}\n\n${words}`,
    typedPrompt: words,
    model,
    origin: 'director',
    aspectRatio: FRAME_RATIO,
    referenceImageIds,
  })
  await updateImageMeta(recordId, `Scene ${scene.number} — ${label}`, words)
  return recordId
}

/**
 * Create storyboard: describe every line's two frames, then submit every
 * opening.
 *
 * All-at-once for the openings, settled by the standard poll like every other
 * generation in the app. The closings follow one by one as the openings land.
 *
 * **It replaces the board rather than adding to one.** The reference tabs are
 * collections pruned by deleting; a storyboard is an ordered thing, and two
 * plans of the same script side by side is not a storyboard. The frames the old
 * board made are trashed with it.
 */
export async function createStoryboard(sessionId: string): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))

  const { characters, locations } = await sheetsOf(session.id)
  if (characters.length === 0 || locations.length === 0)
    throw new Error(
      'A storyboard needs at least one character sheet and one location sheet. Extract them first.',
    )

  /* The script, read off the clips exactly as the Script tab reads it -- what
     survived being pared down, not what was written. */
  const clips = await listVideos('director')
  const byId = new Map(clips.map((clip) => [clip.id, clip]))
  const picked = session.cut.clipIds.flatMap((id) => {
    const clip = byId.get(id)
    return clip ? [clip] : []
  })
  /* Spoken lines only, and their own numbers: a clip carrying no line is not a
     scene of this script, and the ones around it keep the numbers the Script
     tab prints for them. */
  const lines = dialogueOf(picked).filter((line) => line.spoken)
  if (lines.length === 0)
    throw new Error('This session has no script to storyboard.')

  const plan = await planStoryboard({ lines, characters, locations })
  const scenes = assembleScenes({
    plan,
    lines,
    characters,
    locations,
    newId: randomUUID,
  })
  if (scenes.length === 0)
    throw new Error('No frames could be planned for this script.')

  /* Settled, not all-or-nothing, on `extractReferences`' reasoning: a submit
     that failed has already left a failed row, and the ones that went through
     are being made and paid for. */
  const submitted = await Promise.allSettled(
    scenes.map((scene) =>
      submitFrame({
        instruction: openFramePrompt,
        scene,
        words: scene.openingPrompt,
        referenceImageIds: sceneReferenceIds(scene),
        model: FRAME_MODEL_SLUG,
        label: 'Opening',
      }),
    ),
  )
  const withFrames = scenes.map((scene, index) => {
    const result = submitted[index]
    return {
      ...scene,
      openingId: result.status === 'fulfilled' ? result.value : null,
    }
  })

  const previous = boardImageIds(session.board)
  const saved = await saveBoard(userId, session.id, withFrames)
  if (previous.length > 0) await trashSessionClips(userId, previous)
  if (withFrames.every((scene) => scene.openingId === null)) {
    const failed = submitted[0]
    throw failed.status === 'rejected' && failed.reason instanceof Error
      ? failed.reason
      : new Error('The storyboard frames could not be generated.')
  }
  return saved
}

/**
 * The closing frame of one scene, generated from its own opening.
 *
 * Called by the page as each opening lands (see `scenesToClose`), never by a
 * person: the pair is what a scene is, and asking for the second half by hand
 * would make a half-drawn board something to manage.
 */
export async function closeScene(
  sessionId: string,
  sceneId: string,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const scene = session.board.scenes.find(
    (s) => s.id === idSchema.parse(sceneId),
  )
  if (!scene) throw new Error('That scene is not in this session.')
  /* Not an error: two tabs draining the same board is the ordinary case, and
     the second one has nothing to do rather than something to complain about. */
  if (scene.closingId || !scene.openingId) return session

  const closingId = await submitFrame({
    instruction: closeFramePrompt,
    scene,
    words: scene.closingPrompt,
    /* The opening frame first, then the same sheets it was drawn from: every
       frame of every scene sees the character and the place it is of, rather
       than inheriting them from a copy of a copy. */
    referenceImageIds: closingReferenceIds(scene, scene.openingId),
    model: FRAME_MODEL_SLUG,
    label: 'Closing',
  })
  return updateBoardScene(userId, session.id, scene.id, { closingId })
}

/**
 * Re-run one scene with guidance (#695).
 *
 * **It replaces the scene's pair rather than adding beside it**, which is the
 * one place this differs from the reference tabs: a storyboard is an ordered
 * thing and a scene with three candidate openings in it is not a row you can
 * read. The pair it replaced goes to Trash, one restore away, exactly as a
 * re-rolled clip does.
 *
 * The opening is generated again from the sheets with the words appended, and
 * the closing is cleared so the page derives it from the new opening.
 */
export async function rerunScene(
  sessionId: string,
  sceneId: string,
  words: string,
  modelSlug: string,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const scene = session.board.scenes.find(
    (s) => s.id === idSchema.parse(sceneId),
  )
  if (!scene) throw new Error('That scene is not in this session.')

  const asked = words.trim().slice(0, 2000)
  if (!asked) throw new Error('Say what you want changed about this scene.')
  if (!(RERUN_MODEL_SLUGS as ReadonlyArray<string>).includes(modelSlug))
    throw new Error('Pick a model.')

  const openingId = await submitFrame({
    instruction: openFramePrompt,
    scene,
    words: `${scene.openingPrompt}\n\n${asked}`,
    referenceImageIds: sceneReferenceIds(scene),
    model: modelSlug,
    label: 'Opening',
  })
  return updateBoardScene(
    userId,
    session.id,
    scene.id,
    /* The model travels with the scene so a later Retry repairs the pair with
       the hand that drew it (#699). */
    { openingId, closingId: null, guidance: asked, model: modelSlug },
    [scene.openingId, scene.closingId].filter(
      (id): id is string => id !== null,
    ),
  )
}

/**
 * Generate the section one row is a spec for (#697).
 *
 * **The row maps onto one Kling O3 Pro request with nothing left over**: the
 * opening frame is the first frame, the sheets it was drawn from are the
 * references, and the line's own seconds are the duration. Fixed 16:9, audio
 * on, no picker -- the storyboard's lock-down, for the same reason.
 *
 * **The closing frame is not sent, though the endpoint takes one.** Real pairs
 * read as cuts, which is two camera setups; a single continuous take pinned at
 * both ends of two setups is a morph or a slow push rather than footage. The
 * cut is pinned on the other side instead -- the next row's own opening frame
 * is what the join was judged against, and that is the frame that row's clip
 * begins on.
 *
 * **The opening frame is always sent, and that is not symmetric.** The sheets
 * are deliberately neutral records -- flat studio light, plain backgrounds, no
 * grade -- so with references alone nothing in the request carries what the
 * film looks like, and the model would invent it per row. The opening frame is
 * the only input that carries it.
 *
 * **Takes add.** A second press is another candidate beside the first, never
 * over it: a frame is a spec and there is one of it; a take is a candidate.
 */
export async function generateSectionVideo(
  sessionId: string,
  sceneId: string,
  words?: string,
  /**
   * What the character should say in this take, when it is not the line as
   * recorded (#700).
   *
   * **The same field a pronunciation respelling writes**, because it is the
   * same thing: what the model is told to say, as against what the film says.
   * The two reasons to set it differ -- a respelling keeps what is heard and
   * only fixes how it is said, while a rephrasing changes what is heard -- but
   * both are one consumer's version of a line whose record lives elsewhere, and
   * a second field for the second reason would be two things to keep in step
   * for no gain.
   *
   * The reason it earns a box on the dialog: Kling refuses a line naming a
   * trademarked work, the line cannot be reworded by a model on the author's
   * behalf, and the author rewording it is the only thing that gets that
   * section made at all.
   */
  spoken?: string,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const scene = session.board.scenes.find(
    (s) => s.id === idSchema.parse(sceneId),
  )
  if (!scene) throw new Error('That scene is not in this session.')
  if (!scene.openingId)
    throw new Error('This scene has no opening frame to start from yet.')

  const asked = words?.trim().slice(0, 2000)
  /* Written before the submit, so the take is generated from what the board
     will show as having been said -- and so a refused take still leaves the
     rewording behind to try again from. */
  const said = spokenOf(spoken ?? null, scene.line)
  const speaking = spoken === undefined ? scene : { ...scene, spokenLine: said }
  /* The fixed instruction, then what the shot is, then what it is heading for,
     then the line. The closing frame is not sent, but its description is: it
     is the account of where the shot ends up, which is what the motion is.
     Guidance goes last, where a later sentence overrides an earlier one. */
  const prompt = [
    sectionPrompt.trim(),
    scene.openingPrompt,
    `It moves toward this: ${scene.closingPrompt}`,
    /* The chat's own marker, which is how a line reaches the model as speech
       rather than as description (`composeClipPrompt`, read back by
       `dialogueOf`). Reading back a structure the app wrote. */
    /* The respelling when there is one (#700): Kling takes a plain prompt and
       no lexicon, so the spelling sent is the pronunciation. `scene.line` stays
       the record and is what the Script tab reads. */
    `Speaking to camera, in English: "${lineToSpeak(speaking)}"`,
    ...(asked ? [asked] : []),
  ].join('\n\n')

  const { recordId } = await generateVideo({
    images: [
      { id: scene.openingId, role: 'first' },
      ...sceneReferenceIds(scene).map((id) => ({
        id,
        role: 'reference' as const,
      })),
    ],
    prompt,
    duration: sectionDuration(scene.seconds),
    aspectRatio: SECTION_RATIO,
    modelSlug: SECTION_MODEL_SLUG,
    generateAudio: true,
    origin: 'director',
  })
  await updateImageMeta(
    recordId,
    `Scene ${scene.number} — Take ${scene.videoIds.length + 1}`,
    asked ?? scene.line,
  )

  /* Appended, and never into `cut.clipIds`: the board is not the run, and a
     take joining the row would put it in the player and in Script. */
  return updateBoardScene(userId, session.id, scene.id, {
    videoIds: [...scene.videoIds, recordId],
    ...(spoken === undefined ? {} : { spokenLine: said }),
  })
}

/**
 * Retry one failed frame, in place (#699).
 *
 * **Not a re-plan and not a re-run.** Nothing about the scene changes: the same
 * prompt, the same references, the same position, asked again. The failed row
 * goes to Trash the way a re-rolled clip's does.
 *
 * It exists because a failed frame was otherwise a dead end. The drain only
 * picks up a scene whose `closingId` is null, and a failed row's id is stored
 * like a good one -- so a scene that lost half its pair stayed half-drawn, and
 * the only repair on offer was Rerun with guidance, which replaces the pair and
 * throws away an opening frame that was never the problem.
 *
 * **The likeliest cause of a failure here is not the prompt.** Nano Banana 2
 * answers every failed generation with one catch-all that leads with "unsafe
 * content" and goes on to list a media-type mismatch, a missing attachment and
 * "other cases" -- so a transient miss accuses itself of moderation. Asking
 * again is the honest first move, which is the other half of why this is a
 * button and not an edit.
 */
export async function retryFrame(
  sessionId: string,
  sceneId: string,
  which: 'opening' | 'closing',
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const scene = session.board.scenes.find(
    (s) => s.id === idSchema.parse(sceneId),
  )
  if (!scene) throw new Error('That scene is not in this session.')

  const failedId = which === 'opening' ? scene.openingId : scene.closingId
  if (!failedId) throw new Error('There is nothing to retry on that frame.')
  /* Checked against the row rather than taken from the caller: a retry of a
     frame that is merely slow would trash a generation still being paid for. */
  const row = first(
    await sql<Array<{ status: string }>>`
      select status from user_images
      where id = ${failedId} and user_id = ${userId}
        and origin = 'director' and deleted_at is null
    `,
  )
  if (!row || row.status !== 'failed')
    throw new Error('That frame has not failed, so there is nothing to retry.')

  const model = scene.model ?? FRAME_MODEL_SLUG
  if (which === 'closing') {
    if (!scene.openingId)
      throw new Error('This scene has no opening frame to derive from.')
    const closingId = await submitFrame({
      instruction: closeFramePrompt,
      scene,
      words: scene.closingPrompt,
      referenceImageIds: closingReferenceIds(scene, scene.openingId),
      model,
      label: 'Closing',
    })
    return updateBoardScene(userId, session.id, scene.id, { closingId }, [
      failedId,
    ])
  }

  const openingId = await submitFrame({
    instruction: openFramePrompt,
    scene,
    words: scene.guidance
      ? `${scene.openingPrompt}\n\n${scene.guidance}`
      : scene.openingPrompt,
    referenceImageIds: sceneReferenceIds(scene),
    model,
    label: 'Opening',
  })
  /* The closing is left alone. A closing frame is derived from a *completed*
     opening, so a scene whose opening failed has none -- and where one somehow
     exists it was drawn from a frame that worked, which this retry is not
     replacing. */
  return updateBoardScene(userId, session.id, scene.id, { openingId }, [
    failedId,
  ])
}

/**
 * Ask FAL about this board's pending takes, on the server, when the page loads.
 *
 * **Because a section outlives the tab that asked for it.** Every other
 * generation in the app settles on the browser's poll, and that works because
 * an image takes twenty seconds -- you are still looking at it. A section takes
 * four to eight minutes (fal's own p50 is 250s), so the honest thing to do
 * while waiting is go and look at something else, and a hidden tab stops
 * polling. Two takes sat finished at FAL and pending here for twenty-two
 * minutes on the day this was built, with every server-side step working. The
 * board was simply never asked.
 *
 * So coming back to the page is enough, always. The client poll stays -- it is
 * what settles a take while you *are* watching -- and this is what makes its
 * absence survivable rather than permanent.
 *
 * Bounded by `MAX_SETTLE_PER_LOAD`: a finished take is a download and a poster
 * before the page can render, and a page that waits on eight of them is a page
 * that feels broken in a different way. The rest settle on the next load or on
 * the poll.
 *
 * **One at a time, and that is not caution for its own sake.** The first cut
 * ran them through `Promise.all`, and the first time two takes were ready
 * together one settled and the other threw and stayed pending -- the same shape
 * #556 documents for concurrent multi-megabyte transfers on one FAL connection,
 * where five of eleven died and six went through. Each settle is a 16MB
 * download plus an upload; four of them in series is a few seconds, and it
 * costs nothing worth having.
 */
const MAX_SETTLE_PER_LOAD = 4

export async function settleBoardTakes(sessionId: string): Promise<void> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const takeIds = session.board.scenes.flatMap((scene) => scene.videoIds)
  if (takeIds.length === 0) return

  const pending = await sql<
    Array<{
      id: string
      request_id: string | null
      fal_model_id: string | null
    }>
  >`
    select id, request_id,
           generation_metadata->>'fal_model_id' as fal_model_id
    from user_images
    where user_id = ${userId}
      and id = any(${takeIds})
      and origin = 'director'
      and status = 'pending'
      and request_id is not null
      and deleted_at is null
    order by created_at
    limit ${MAX_SETTLE_PER_LOAD}
  `

  /* Which scene each take belongs to, so its name can be put back below. */
  const labels = new Map(
    session.board.scenes.flatMap((scene) =>
      scene.videoIds.map((takeId, index) => [
        takeId,
        `Scene ${scene.number} — Take ${index + 1}`,
      ]),
    ),
  )

  for (const row of pending) {
    if (!row.fal_model_id || !row.request_id) continue
    try {
      const status = await fal.queue.status(row.fal_model_id, {
        requestId: row.request_id,
        logs: false,
      })
      /* Only the finished ones. A take still in the queue is left exactly as
         it is -- deciding it has failed is the poll's job, which owns the
         deadline and the error blob, and duplicating that here would be two
         places disagreeing about when to give up. */
      if (status.status !== 'COMPLETED') continue
      const result = (await fal.queue.result(row.fal_model_id, {
        requestId: row.request_id,
      })) as { data: Record<string, unknown> }
      await processVideoResult(row.id, userId, result.data)
      /* **The name has to be put back.** Completing a clip rewrites its title
         from the model label -- deliberately, since a clip made on the Video
         wall should say what made it -- so a take named at submit comes back
         called "Kling O3 Pro" and the board's own naming is lost everywhere it
         is read from the row: Activity, Trash, the library. */
      const label = labels.get(row.id)
      /* The title alone, written here rather than through `updateImageMeta`:
         that one takes a description and would write it, and this take's
         description is the prompt it was generated from. */
      if (label)
        await sql`
          update user_images set title = ${label}
          where id = ${row.id} and user_id = ${userId}
        `
    } catch (cause) {
      /**
       * **A refused take has to be written down, or it says "working" for
       * ever.**
       *
       * `queue.status` answers COMPLETED for a request the provider refused on
       * content grounds, and the refusal only surfaces when the result is
       * fetched -- as a 422. So the happy path above sails past the status
       * check and throws here, and the first version of this simply logged it:
       * the take stayed pending, the board kept saying "working", and the only
       * account of what happened was on fal's dashboard.
       *
       * The verdict is the poll's own (`isFalRejection`), so the two cannot
       * disagree about what counts as the provider refusing. Anything else --
       * a network blip, a bucket hiccup -- leaves the row pending, which is
       * true, and the next load or the poll tries again.
       */
      if (isFalRejection(cause)) {
        const blob = extractFalError(cause)
        blob.stage = 'queue'
        if (blob.code === 'unknown') blob.code = 'fal_queue'
        blob.fal_request_id ??= row.request_id
        await markGenerationFailedWithBlob(row.id, blob)
      }
      console.error(
        `[storyboard] take=${row.id} did not settle: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
  }
}

/**
 * Drop one take off a row and trash it (#697).
 *
 * **Because takes add, something has to subtract.** A refused take is a dead
 * tile on a row that will otherwise carry it for the life of the board, and
 * the frames' lesson applies here too: a thing you cannot clear is a thing you
 * work around. It goes to Trash like every other Director row, so a take
 * dropped by mistake is one restore away.
 */
export async function dropTake(
  sessionId: string,
  sceneId: string,
  takeId: string,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const scene = session.board.scenes.find(
    (s) => s.id === idSchema.parse(sceneId),
  )
  if (!scene) throw new Error('That scene is not in this session.')
  idSchema.parse(takeId)
  if (!scene.videoIds.includes(takeId))
    throw new Error('That take is not on this scene.')

  return updateBoardScene(
    userId,
    session.id,
    scene.id,
    { videoIds: scene.videoIds.filter((id) => id !== takeId) },
    [takeId],
  )
}

/**
 * Fix pronunciation across the board (#700).
 *
 * One Claude call over every line, filling `spokenLine` and touching nothing
 * else: no frames are replanned, no takes are affected, and `line` -- the
 * record -- is unchanged. Non-destructive on purpose, because the board this is
 * for already has frames worth keeping and re-planning would replace them.
 *
 * **It overwrites what was there**, unlike everything else on this board that
 * adds. A respelling is a correction rather than a candidate, and two of them
 * for one line is not something anybody would choose between.
 */
export async function pronounceBoard(sessionId: string): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  if (session.board.scenes.length === 0)
    throw new Error('There is no storyboard to read.')

  const spoken = await pronounceLines(
    session.board.scenes.map((scene) => ({
      number: scene.number,
      line: scene.line,
    })),
  )

  const scenes = session.board.scenes.map((scene) => ({
    ...scene,
    /* A line the model did not answer for keeps whatever it had: silence is
       not an instruction to throw away a respelling that was working. */
    spokenLine: spoken.has(scene.number)
      ? spokenOf(spoken.get(scene.number) ?? null, scene.line)
      : scene.spokenLine,
  }))

  return saveBoard(userId, session.id, scenes)
}

/**
 * Set what one scene says, from the row (#700).
 *
 * **The board is where a script is made ready to shoot.** Editing a line only
 * inside Generate video meant finding out a line was wrong at the moment of
 * spending, one row at a time; here a pass down the board fixes every line that
 * would be refused or mispronounced before anything is generated. Same field,
 * so the dialog and the row can never disagree.
 *
 * Saving the line as the script has it clears the override rather than storing
 * a copy of it -- `spokenOf`'s rule -- so reverting is retyping the original
 * and needs no separate affordance.
 */
export async function setSpokenLine(
  sessionId: string,
  sceneId: string,
  spoken: string,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const scene = session.board.scenes.find(
    (s) => s.id === idSchema.parse(sceneId),
  )
  if (!scene) throw new Error('That scene is not in this session.')
  if (!spoken.trim()) throw new Error('A scene has to say something.')

  return updateBoardScene(userId, session.id, scene.id, {
    spokenLine: spokenOf(spoken, scene.line),
  })
}
