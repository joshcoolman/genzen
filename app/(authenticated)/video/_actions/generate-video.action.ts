'use server'

import { fal } from '@fal-ai/client'
import {
  DEFAULT_VIDEO_MODEL,
  aspectRatiosFor,
  endpointFor,
  estimateCostCents,
  videoModelBySlug,
} from '#/features/video/models'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '#/lib/server/create-pending-generation.server'
import { uploadLibraryImagesToFal } from '#/lib/server/fal-image-inputs.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export interface GenerateVideoInput {
  /** Optional. Without one the model invents the whole shot from the prompt --
   *  a different endpoint, and the one that needs the better prompt. */
  imageId?: string
  /** Optional last frame. With one, the model solves the move between the two
   *  stills rather than inventing where the shot goes. */
  endImageId?: string
  prompt: string
  duration: number
  aspectRatio: string
  modelSlug?: string
}

/**
 * Queue one clip (#305).
 *
 * Shaped like the image path deliberately: reserve the row *before* FAL is
 * contacted, so a submit that never happens still leaves a visible record, then
 * attach the request id. The poll in `check-pending-generations.action.ts`
 * settles it -- nothing here waits.
 */
export async function generateVideo({
  imageId,
  endImageId,
  prompt,
  duration,
  aspectRatio,
  modelSlug,
}: GenerateVideoInput): Promise<{ recordId: string }> {
  const { userId } = await resolveAuth()

  const trimmed = prompt.trim()
  if (!trimmed) throw new Error('A prompt is required')

  const model =
    (modelSlug && videoModelBySlug(modelSlug)) || DEFAULT_VIDEO_MODEL
  if (!model.durations.includes(duration)) {
    throw new Error(`Unsupported duration: ${duration}`)
  }

  const hasFirstFrame = !!imageId
  const hasLastFrame = !!endImageId
  const endpoint = endpointFor(model, hasFirstFrame, hasLastFrame)

  // Checked against the endpoint, not the model: `auto` is valid only where
  // there is an image to match, and an endpoint with an empty list has no
  // `aspect_ratio` param at all -- H3's image endpoint follows the frame it is
  // given, so any value is one param too many.
  const ratios = aspectRatiosFor(model, hasFirstFrame, hasLastFrame)
  if (ratios.length > 0 && !ratios.includes(aspectRatio)) {
    throw new Error(`Unsupported aspect ratio: ${aspectRatio}`)
  }

  if (endImageId && !hasFirstFrame) {
    throw new Error('An end frame needs a first frame')
  }

  // Both frames are checked in one statement: two round trips to prove the
  // same thing, and a partial check would let an unreadable end frame fail
  // after the row was reserved.
  const wanted = [imageId, endImageId].filter((id): id is string => !!id)
  if (wanted.length > 0) {
    const found = await sql<Array<{ id: string }>>`
      select id from user_images
      where id in ${sql(wanted)} and user_id = ${userId}
        and deleted_at is null and status = 'completed'
    `
    if (found.length !== new Set(wanted).size) {
      throw new Error('Source image not found')
    }
  }

  if (endImageId && !endpoint.acceptsEndImage) {
    throw new Error(`${model.label} takes no end frame`)
  }

  const estimatedCostCents = estimateCostCents(model, duration)

  const { recordId } = await createPendingGeneration({
    userId,
    origin: 'images',
    source: 'ai_video',
    generationType: hasFirstFrame ? 'image_to_video' : 'text_to_video',
    falModelId: endpoint.id,
    prompt: trimmed,
    aspectRatio,
    // The default title resolves an *image* endpoint against the image lineup,
    // which knows nothing about clips. The label is already in hand here, and a
    // clip's card should name its model from the first frame like any other
    // (#367).
    title: model.label,
    extraMetadata: {
      // Read back by `processVideoResult` for the row's title, so a
      // `.server.ts` module never has to import the route-owned catalog.
      model_label: model.label,
      ...(imageId ? { source_image_id: imageId } : {}),
      ...(endImageId ? { end_image_id: endImageId } : {}),
      duration_seconds: duration,
      resolution: model.resolution,
      estimated_cost_cents: estimatedCostCents,
    },
  })

  try {
    // The bucket is private (#226), so FAL cannot fetch our URL -- the bytes go
    // up to FAL's own storage first. Same seam the image paths use.
    // One call, caller order preserved -- the helper resolves by the ids given,
    // not by whatever the database returned.
    const uploaded = await uploadLibraryImagesToFal(wanted, userId)
    if (uploaded.length !== wanted.length) {
      throw new Error('Could not read the source image')
    }
    const [uploadedUrl, uploadedEndUrl] = uploaded

    // Built from the endpoint descriptor, never from a fixed list (#385). Three
    // models, three disagreements: Flux 3's first+last endpoint names the first
    // frame `start_image_url`, H3's image endpoint has no `aspect_ratio`, and
    // only two of the three take `generate_audio`. Sending a param an endpoint
    // does not declare is how a submit fails at FAL rather than here.
    const { request_id } = await fal.queue.submit(endpoint.id, {
      input: {
        prompt: trimmed,
        ...(uploadedUrl && endpoint.firstFrameParam
          ? { [endpoint.firstFrameParam]: uploadedUrl }
          : {}),
        ...(uploadedEndUrl && endpoint.acceptsEndImage
          ? { end_image_url: uploadedEndUrl }
          : {}),
        duration,
        ...(endpoint.aspectRatios.length > 0
          ? { aspect_ratio: aspectRatio }
          : {}),
        resolution: model.resolution,
        ...(model.supportsAudio ? { generate_audio: true } : {}),
      },
    })

    await markGenerationSubmitted(recordId, request_id)
  } catch (err) {
    await markGenerationFailed(
      recordId,
      describeGenerationError(err, 'Video generation failed'),
    )
    throw err
  }

  return { recordId }
}

export interface VideoRecord {
  id: string
  title: string
  description: string | null
  status: string
  generation_error: string | null
  created_at: string
  generation_metadata: Record<string, unknown> | null
}

/**
 * Every clip this user has made, newest first. Videos are excluded from the
 * gallery query by its `source in ('upload', 'ai_generated')` filter, so this
 * route is the only place they are listed.
 */
export async function listVideos(): Promise<Array<VideoRecord>> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<VideoRecord>>`
    select id, title, description, status, generation_error,
           to_json(created_at)#>>'{}' as created_at,
           generation_metadata
    from user_images
    where user_id = ${userId}
      and source = 'ai_video'
      and deleted_at is null
    order by created_at desc
  `

  return rows as unknown as Array<VideoRecord>
}
