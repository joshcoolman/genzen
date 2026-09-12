import 'server-only'
import { after } from 'next/server'
import { uncertainWork } from './final-cut'
import {
  checkpointFinalCut,
  claimFinalCut,
  failFinalCut,
  finishFinalCut,
  finishScript,
  releaseFinalCut,
  renewFinalCut,
} from './final-cuts.server'
import { frameAspect, writeSectionScript } from './final-script.server'
import { getExport } from './exports.server'
import { readMedia, storeMedia } from './media.server'
import { ingestVideo } from './ingest.server'
import {
  assembleFinalCut,
  assembleScriptCut,
  extractFinalFrames,
} from './final-media.server'
import { planFinalCut, planningWasRejected } from './final-plan.server'
import {
  FINAL_MODELS,
  downloadFinalMedia,
  runFinalProvider,
} from './final-provider.server'
import type { FinalStep } from './final-cut'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import shotInstructions from '#/lib/prompts/director-final-shot.md'

/**
 * What a script render generates on (#640). Turbo, because the hand-run
 * showed it is good enough at 480P and its speed is what makes twelve
 * sequential sections tolerable. Both endpoints checked against FAL's
 * schema on 2026-09-12: text-to-video takes `aspect_ratio`, image-to-video
 * takes `image_url` and follows the frame's shape.
 */
export const SCRIPT_MODELS = {
  textToVideo: 'minimax/h3-max-turbo/text-to-video',
  imageToVideo: 'minimax/h3-max-turbo/image-to-video',
} as const

export function scheduleFinalCut(owner: string, id: string) {
  after(async () => {
    try {
      await runFinalCut(owner, id)
    } catch (error) {
      console.error('[director-final-cut]', id, error)
    }
  })
}
export async function runFinalCut(owner: string, id: string) {
  const job = await claimFinalCut(owner, id)
  if (!job?.lease_id) return
  const lease = job.lease_id
  const work = job.work
  const deadline = Date.now() + 45 * 60 * 1000
  let stopped = false
  let stage = job.stage
  const heartbeat = setInterval(() => {
    void renewFinalCut(owner, id, lease)
      .then((ok) => {
        if (!ok) stopped = true
      })
      .catch(() => {
        stopped = true
      })
  }, 20000)
  const alive = async () => {
    if (stopped || Date.now() > deadline)
      throw new Error(
        'Final Cut paused. Resume to continue from its saved progress.',
      )
    if (!(await renewFinalCut(owner, id, lease)))
      throw new Error('Final Cut stopped.')
  }
  const checkpoint = async (nextStage = stage) => {
    stage = nextStage
    await checkpointFinalCut(owner, id, lease, stage, work)
  }
  try {
    if (uncertainWork(work))
      throw new Error(
        'An interrupted paid request has no saved result or receipt. Check the provider before starting another Final Cut; this attempt will not submit it again.',
      )
    const source = await getExport(owner, job.session_id, job.export_id)
    if (!source) throw new Error('Source export not found.')
    // A render of a finished Script (#640): the hand-run made automatic.
    // Section 1 is text-to-video; every later section is image-to-video from
    // the previous clip's end frame, which is what makes the joins seamless
    // and why this is sequential by nature. Plan and script were copied in
    // at creation, so nothing here samples frames or plans; the clips are
    // stitched with their own sound.
    if (work.fromScript) {
      const script = work.script
      const plan = work.plan
      if (!script || !plan)
        throw new Error('This render has no script to work from.')
      const steps = (work.steps ??= {})
      const clips: Array<{ mediaId: string; duration: number }> = []
      for (const [index, section] of script.sections.entries()) {
        await checkpoint(`Section ${index + 1} of ${script.sections.length}`)
        const key = `section-${index}`
        let step = steps[key]
        if (!step?.requestId) {
          // The input is fixed before the first submit and saved with it, so
          // a resume replays the same request rather than re-uploading a
          // frame under a new URL.
          const previous = index > 0 ? steps[`section-${index - 1}`] : undefined
          let imageUrl: string | undefined
          if (index > 0) {
            if (!previous?.endFrameId)
              throw new Error(
                `Section ${index} has no end frame to continue from.`,
              )
            await alive()
            const frame = await readMedia(owner, previous.endFrameId)
            imageUrl = await uploadBufferToFal(await frame.arrayBuffer())
          }
          step = await runFinalProvider({
            steps,
            key,
            endpoint: imageUrl
              ? SCRIPT_MODELS.imageToVideo
              : SCRIPT_MODELS.textToVideo,
            input: {
              prompt: section.text,
              duration: section.duration,
              resolution: '480P',
              prompt_expansion_mode: 'balanced',
              enable_safety_checker: true,
              ...(imageUrl
                ? { image_url: imageUrl }
                : { aspect_ratio: script.aspectRatio }),
            },
            checkpoint,
            alive,
          })
        } else {
          step = await runFinalProvider({
            steps,
            key,
            endpoint: step.endpoint,
            input: step.input ?? {},
            checkpoint,
            alive,
          })
        }
        if (!step.mediaId) {
          await alive()
          const clip = await ingestVideo(
            owner,
            job.session_id,
            await downloadFinalMedia(step.url!, 'video/mp4'),
            id,
          )
          step.mediaId = clip.mediaId
          step.endFrameId = clip.endFrameId
          await checkpoint()
        }
        clips.push({ mediaId: step.mediaId, duration: section.duration })
      }
      await checkpoint('Finishing the picture')
      await alive()
      const movie = await assembleScriptCut(
        clips.map((clip) => ({
          blob: () => readMedia(owner, clip.mediaId),
          duration: clip.duration,
        })),
      )
      await alive()
      const output = await ingestVideo(owner, job.session_id, movie, id)
      await finishFinalCut(owner, id, lease, output)
      return
    }
    if (!work.frames) {
      await checkpoint('Reading the rough cut')
      const frames = await extractFinalFrames(
        await readMedia(owner, source.media_id),
        source,
      )
      work.frames = []
      for (const frame of frames) {
        await alive()
        const mediaId = await storeMedia(owner, job.session_id, frame.blob, id)
        work.frames.push({ mediaId, time: frame.time, section: frame.section })
      }
      await checkpoint()
    }
    if (!work.plan) {
      work.planning = true
      await checkpoint('Directing the final cut')
      await alive()
      try {
        work.plan = await planFinalCut(owner, source, work.frames, alive)
      } catch (error) {
        if (planningWasRejected(error)) {
          work.planning = false
          await checkpoint()
        }
        throw error
      }
      await checkpoint()
    }
    const plan = work.plan
    // A Script job (#634) stops at text. One section per call, checkpointed
    // as each lands so a resume carries on from the last one saved, and
    // nothing below this block -- references, FAL, assembly -- ever runs.
    if (work.scriptOnly) {
      const script = (work.script ??= {
        aspectRatio: await frameAspect(
          await readMedia(owner, work.frames[0].mediaId),
        ),
        sections: [],
      })
      for (
        let index = script.sections.length;
        index < plan.shots.length;
        index++
      ) {
        await checkpoint(`Writing section ${index + 1} of ${plan.shots.length}`)
        const text = await writeSectionScript({
          plan,
          source,
          index,
          aspectRatio: script.aspectRatio,
          previous: script.sections[index - 1]?.text ?? null,
          beforeRequest: alive,
        })
        const shot = plan.shots[index]
        script.sections.push({
          index,
          duration: shot.duration,
          sources: shot.sections,
          text,
        })
        await checkpoint()
      }
      await finishScript(owner, id, lease, work)
      return
    }
    if (!work.references) {
      const references = []
      for (const index of plan.referenceFrames) {
        await alive()
        const blob = await readMedia(owner, work.frames[index].mediaId)
        references.push(await uploadBufferToFal(await blob.arrayBuffer()))
      }
      work.references = references
      await checkpoint('Preparing references')
    }
    const steps = (work.steps ??= {})
    const request = async (
      key: string,
      endpoint: string,
      input: Record<string, unknown>,
    ) => runFinalProvider({ steps, key, endpoint, input, checkpoint, alive })
    const persist = async (step: FinalStep, type: string) => {
      if (!step.mediaId) {
        await alive()
        step.mediaId = await storeMedia(
          owner,
          job.session_id,
          await downloadFinalMedia(step.url!, type),
          id,
        )
        await checkpoint()
      }
      return step.mediaId
    }
    const clips = []
    for (const [index, shot] of plan.shots.entries()) {
      await checkpoint(`Picture ${index + 1} of ${plan.shots.length}`)
      const video = await request(`picture-${index}`, FINAL_MODELS.video, {
        prompt: [
          shotInstructions,
          plan.continuity,
          plan.style,
          shot.prompt,
        ].join('\n\n'),
        duration: shot.duration,
        resolution: '768P',
        aspect_ratio: 'adaptive',
        prompt_expansion_mode: 'balanced',
        reference_image_urls: work.references,
      })
      const videoId = await persist(video, 'video/mp4')
      clips.push({ mediaId: videoId, duration: shot.duration })
    }
    await checkpoint('Finishing the picture')
    const inputs = clips.map((clip) => ({
      blob: () => readMedia(owner, clip.mediaId),
      duration: clip.duration,
    }))
    await alive()
    const movie = await assembleFinalCut(inputs)
    await alive()
    const output = await ingestVideo(owner, job.session_id, movie, id)
    await finishFinalCut(owner, id, lease, output)
  } catch (error) {
    await failFinalCut(
      owner,
      id,
      lease,
      error instanceof Error ? error.message : 'Final Cut failed.',
    )
  } finally {
    clearInterval(heartbeat)
    await releaseFinalCut(owner, id, lease)
  }
}
