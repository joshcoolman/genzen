import 'server-only'
import { after } from 'next/server'
import { uncertainWork } from './final-cut'
import {
  checkpointFinalCut,
  claimFinalCut,
  failFinalCut,
  finishFinalCut,
  releaseFinalCut,
  renewFinalCut,
} from './final-cuts.server'
import { getExport } from './exports.server'
import { readMedia, storeMedia } from './media.server'
import { ingestVideo } from './ingest.server'
import { assembleFinalCut, extractFinalFrames } from './final-media.server'
import { planFinalCut, planningWasRejected } from './final-plan.server'
import {
  FINAL_MODELS,
  downloadFinalMedia,
  runFinalProvider,
} from './final-provider.server'
import type { FinalStep } from './final-cut'
import { fal } from '#/lib/server/fal-client.server'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import shotInstructions from '#/lib/prompts/director-final-shot.md'

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
        work.plan = await planFinalCut(owner, source, work.frames)
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
      await checkpoint(`Sound ${index + 1} of ${plan.shots.length}`)
      const effectsKey = `effects-${index}`
      // Re-upload our durable picture only before a new sound request. Existing
      // receipts continue polling their original input, even after a restart.
      let videoUrl = ''
      if (!steps[effectsKey]) {
        await alive()
        videoUrl = await fal.storage.upload(await readMedia(owner, videoId))
      }
      const effects = await request(effectsKey, FINAL_MODELS.effects, {
        video_url: videoUrl,
        prompt: shot.sound,
        negative_prompt: 'music, speech, dialogue, vocals',
        duration: shot.duration,
      })
      const mediaId = await persist(effects, 'video/mp4')
      clips.push({ mediaId, duration: shot.duration })
    }
    await checkpoint('Composing the score')
    const music = await request('music', FINAL_MODELS.music, {
      prompt: plan.music,
      seconds_total: plan.shots.reduce((sum, shot) => sum + shot.duration, 0),
    })
    const scoreId = await persist(music, 'audio/wav')
    await checkpoint('Mixing and finishing')
    const inputs = clips.map((clip) => ({
      blob: () => readMedia(owner, clip.mediaId),
      duration: clip.duration,
    }))
    await alive()
    const movie = await assembleFinalCut(
      inputs,
      await readMedia(owner, scoreId),
    )
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
