'use server'

import { fal } from '#/lib/server/fal-client.server'
import { withNetworkRetry } from '#/lib/server/fal-retry.server'
import {
  DEFAULT_VIDEO_MODEL,
  aspectRatiosFor,
  endpointFor,
  estimateCostCents,
  resolutionFor,
  resolutionsFor,
  takesFirstFrame,
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
  /** Only honoured where the model offers tiers; otherwise its fixed one is
   *  sent. Coerced rather than refused, so a value carried across a model
   *  switch cannot fail a submit. */
  resolution?: string
  modelSlug?: string
  /** File the clip into a group at birth (#517), the way a generation made
   *  inside an image group is. This is the half that makes a group a place to
   *  work rather than a folder. Verified server-side against both the caller's
   *  user id and the group's kind -- see `createPendingGeneration`. */
  groupId?: string | null
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
  resolution,
  modelSlug,
  groupId,
}: GenerateVideoInput): Promise<{ recordId: string }> {
  const { userId } = await resolveAuth()

  const trimmed = prompt.trim()
  if (!trimmed) throw new Error('A prompt is required')

  const model =
    (modelSlug && videoModelBySlug(modelSlug)) || DEFAULT_VIDEO_MODEL
  if (!model.durations.includes(duration)) {
    throw new Error(`Unsupported duration: ${duration}`)
  }

  // **A model that takes no frame ignores the ones it was given.** h3-max is
  // text-to-video only. The form already withholds them, so reaching here with
  // one means a caller that does not know the lineup -- and dropping the frame
  // is the same answer the endpoint would give, arrived at before a row is
  // reserved and before the bytes are uploaded for nothing.
  const modelTakesFrames = takesFirstFrame(model)
  const firstFrameId = modelTakesFrames ? imageId : undefined
  const endFrameId = modelTakesFrames ? endImageId : undefined

  const hasFirstFrame = !!firstFrameId
  const hasLastFrame = !!endFrameId
  const endpoint = endpointFor(model, hasFirstFrame, hasLastFrame)

  // The tier actually rendered: the requested one where the model offers it,
  // its fixed `resolution` otherwise. Resolved once, because the estimate and
  // the submit have to name the same thing -- a price quoted at 480P against a
  // clip rendered at 768P is the bug this shape prevents.
  const sentResolution = resolutionFor(model, resolution)
  if (
    resolution &&
    resolutionsFor(model).length > 0 &&
    sentResolution !== resolution
  ) {
    throw new Error(`Unsupported resolution: ${resolution}`)
  }

  // Checked against the endpoint, not the model: `auto` is valid only where
  // there is an image to match, and an endpoint with an empty list has no
  // `aspect_ratio` param at all -- H3's image endpoint follows the frame it is
  // given, so any value is one param too many.
  const ratios = aspectRatiosFor(model, hasFirstFrame, hasLastFrame)
  if (ratios.length > 0 && !ratios.includes(aspectRatio)) {
    throw new Error(`Unsupported aspect ratio: ${aspectRatio}`)
  }

  if (endFrameId && !hasFirstFrame) {
    throw new Error('An end frame needs a first frame')
  }

  // Both frames are checked in one statement: two round trips to prove the
  // same thing, and a partial check would let an unreadable end frame fail
  // after the row was reserved.
  const wanted = [firstFrameId, endFrameId].filter((id): id is string => !!id)
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

  if (endFrameId && !endpoint.acceptsEndImage) {
    throw new Error(`${model.label} takes no end frame`)
  }

  const estimatedCostCents = estimateCostCents(model, duration, sentResolution)

  const { recordId } = await createPendingGeneration({
    userId,
    origin: 'images',
    source: 'ai_video',
    groupId,
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
      ...(firstFrameId ? { source_image_id: firstFrameId } : {}),
      ...(endFrameId ? { end_image_id: endFrameId } : {}),
      duration_seconds: duration,
      resolution: sentResolution,
      estimated_cost_cents: estimatedCostCents,
    },
  })

  try {
    // The bucket is private (#226), so FAL cannot fetch our URL -- the bytes go
    // up to FAL's own storage first. Same seam the image paths use.
    // One call, caller order preserved -- the helper resolves by the ids given,
    // not by whatever the database returned.
    // The helper throws if any frame cannot be read (#364), which is what this
    // route already wanted -- it used to length-check the result by hand,
    // because dropping a frame silently was never acceptable here either.
    const uploaded = await uploadLibraryImagesToFal(wanted, userId)
    const [uploadedUrl, uploadedEndUrl] = uploaded

    // Built from the endpoint descriptor, never from a fixed list (#385). Three
    // models, three disagreements: Flux 3's first+last endpoint names the first
    // frame `start_image_url`, H3's image endpoint has no `aspect_ratio`, and
    // only two of the three take `generate_audio`. Sending a param an endpoint
    // does not declare is how a submit fails at FAL rather than here.
    const { request_id } = await withNetworkRetry('queue.submit', () =>
      fal.queue.submit(endpoint.id, {
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
          resolution: sentResolution,
          ...(model.supportsAudio ? { generate_audio: true } : {}),
        },
      }),
    )

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
  /** The one group this clip sits in, or null for top level (#517). Filtered
   *  client-side exactly as the gallery does it -- the route holds every row
   *  already, so a group view is a filter rather than a second query. */
  group_id: string | null
  generation_metadata: Record<string, unknown> | null
  /** The clip's rectangle, off frame one (#499). Null on a clip whose poster
   *  never decoded, which is the only reason its aspect ratio is unknown. */
  width: number | null
  height: number | null
  /** Taken out of the wall without being destroyed (#537). The same column a
   *  still uses -- `setImagesHidden` never filtered on `source`, so the write
   *  was correct for a clip the day it shipped and only the surface was
   *  missing. Null means visible. */
  hidden_at: string | null
  /** Whether the row points at a stored final frame, not the path itself (#512).
   *  Storage keys are the server's business -- the browser asks `/img/[id]?v=end`
   *  -- but a surface that draws the ending has to know there is one to draw. */
  has_end_frame: boolean
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
           generation_metadata, width, height, group_id,
           to_json(hidden_at)#>>'{}' as hidden_at,
           end_frame_path is not null as has_end_frame
    from user_images
    where user_id = ${userId}
      and source = 'ai_video'
      and deleted_at is null
    order by created_at desc
  `

  return rows as unknown as Array<VideoRecord>
}
