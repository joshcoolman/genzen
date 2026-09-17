'use server'

import { randomUUID } from 'node:crypto'
import {
  FRAME_MODEL_SLUG,
  FRAME_RATIO,
  RERUN_MODEL_SLUGS,
  assembleScenes,
  sceneReferenceIds,
} from '../[id]/board'
import { dialogueOf } from '../[id]/script'
import {
  requireSession,
  saveBoard,
  trashSessionClips,
  updateBoardScene,
} from '../_lib/sessions.server'
import { planStoryboard } from '../_lib/storyboard.server'
import { idSchema } from '../_lib/types'
import { listVideos } from '../../video/_actions/generate-video.action'
import { listSessionRefs } from './references.action'
import type { RefAsset } from './references.action'
import type { BoardScene, Session } from '../_lib/types'
import closeFramePrompt from '#/lib/prompts/director-frame-close.md'
import openFramePrompt from '#/lib/prompts/director-frame-open.md'
import { generateImageInternal } from '#/features/ai-images/server/generate-image-internal.server'
import { updateImageMeta } from '#/features/user-images/server/images.action'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/**
 * The storyboard tab (#695): a first and last frame for every scene, before any
 * video.
 *
 * Twelve images at 8c answer the question a $38 video pass answers -- does the
 * script, the character sheet and the location sheets add up to a story you
 * want to watch. Nothing here generates video and nothing is wired to what
 * comes after it.
 *
 * **Two stages, and that is forced rather than chosen.** The closing frame is
 * generated *from* the scene's opening frame, and a reference is bytes out of
 * the bucket -- there is nothing behind a pending row to upload. So Create
 * storyboard plans the scenes and submits every opening at once, and
 * `closeScene` is called per scene by the page as each opening lands. The
 * frames chain no further than that on purpose: judge the cuts between scenes
 * first, and chain scene to scene once there is something to judge.
 */

/** The frames a storyboard has made, read as they are now -- the tab draws
 *  pending, failed and finished off the row like every other generation. */
export async function listBoardFrames(
  sessionId: string,
): Promise<Record<string, RefAsset>> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const ids = session.board.scenes.flatMap((scene) =>
    [scene.openingId, scene.closingId].filter(
      (id): id is string => id !== null,
    ),
  )
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
 *  is of; the scene's title travels as the row's name, so the board reads as
 *  the film rather than as a list of model badges. */
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
  await updateImageMeta(
    recordId,
    `${scene.number}. ${scene.title} — ${label}`,
    words,
  )
  return recordId
}

/**
 * Create storyboard: plan the scenes, then submit every opening frame.
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
  const lines = dialogueOf(picked).filter((line) => line.spoken)
  if (lines.length === 0)
    throw new Error('This session has no script to break into scenes.')

  const plan = await planStoryboard({ lines, characters, locations })
  const scenes = assembleScenes({
    plan,
    lines,
    characters,
    locations,
    newId: randomUUID,
  })
  if (scenes.length === 0)
    throw new Error('The script could not be broken into scenes.')

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

  const previous = session.board.scenes.flatMap((scene) =>
    [scene.openingId, scene.closingId].filter(
      (id): id is string => id !== null,
    ),
  )
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
    referenceImageIds: [scene.openingId],
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
    { openingId, closingId: null, guidance: asked },
    [scene.openingId, scene.closingId].filter(
      (id): id is string => id !== null,
    ),
  )
}
