'use server'

import type { VideoImageInput } from '#/features/video/inputs'
import { fal } from '#/lib/server/fal-client.server'
import { withNetworkRetry } from '#/lib/server/fal-retry.server'
import { DEFAULT_VIDEO_MODEL, videoModelBySlug } from '#/features/video/models'
import {
  videoFalInput,
  videoImagesSchema,
  videoRequestPlan,
} from '#/features/video/inputs'
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
  images?: Array<VideoImageInput>
  prompt: string
  duration: number
  aspectRatio: string
  /** Only honoured where the model offers tiers; otherwise its fixed one is
   *  sent. Coerced rather than refused, so a value carried across a model
   *  switch cannot fail a submit. */
  resolution?: string
  modelSlug?: string
  generateAudio?: boolean
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
  images: rawImages = [],
  prompt,
  duration,
  aspectRatio,
  resolution,
  modelSlug,
  generateAudio = true,
  groupId,
}: GenerateVideoInput): Promise<{ recordId: string }> {
  const { userId } = await resolveAuth()

  const images = videoImagesSchema.parse(rawImages)
  const model = modelSlug ? videoModelBySlug(modelSlug) : DEFAULT_VIDEO_MODEL
  if (!model) throw new Error('Unknown video model')
  const plan = videoRequestPlan(
    model,
    images,
    prompt,
    duration,
    aspectRatio,
    resolution,
    generateAudio,
  )
  const {
    endpoint,
    prompt: trimmed,
    resolution: sentResolution,
    estimatedCostCents,
  } = plan
  const firstFrameId = images.find((i) => i.role === 'first')?.id
  const endFrameId = images.find((i) => i.role === 'last')?.id
  const referenceIds = images
    .filter((i) => i.role === 'reference')
    .map((i) => i.id)
  const wanted = images.map((i) => i.id)
  if (wanted.length > 0) {
    const found = await sql<Array<{ id: string }>>`
      select id from user_images
      where id in ${sql(wanted)} and user_id = ${userId}
        and deleted_at is null and status = 'completed'
        and source in ('upload', 'ai_generated')
    `
    if (found.length !== new Set(wanted).size) {
      throw new Error('Source image not found')
    }
  }

  const { recordId } = await createPendingGeneration({
    userId,
    origin: 'images',
    source: 'ai_video',
    groupId,
    generationType: images.length > 0 ? 'image_to_video' : 'text_to_video',
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
      input_images: images,
      reference_image_ids: referenceIds,
      ...(firstFrameId ? { source_image_id: firstFrameId } : {}),
      ...(endFrameId ? { end_image_id: endFrameId } : {}),
      duration_seconds: duration,
      resolution: sentResolution,
      estimated_cost_cents: estimatedCostCents,
      ...(model.supportsAudio ? { generate_audio: generateAudio } : {}),
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

    // Built from the endpoint descriptor, never from a fixed list (#385). Three
    // models, three disagreements: Flux 3's first+last endpoint names the first
    // frame `start_image_url`, H3's image endpoint has no `aspect_ratio`, and
    // only two of the three take `generate_audio`. Sending a param an endpoint
    // does not declare is how a submit fails at FAL rather than here.
    const { request_id } = await withNetworkRetry('queue.submit', () =>
      fal.queue.submit(endpoint.id, {
        input: videoFalInput(endpoint, images, uploaded, {
          prompt: trimmed,
          duration,
          aspectRatio,
          resolution: sentResolution,
          supportsAudio: model.supportsAudio,
          generateAudio,
        }),
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
