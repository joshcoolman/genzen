'use server'

import { fal } from '@fal-ai/client'
import {
  DEFAULT_VIDEO_MODEL,
  estimateCostCents,
  videoModelBySlug,
} from '../models'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '#/lib/server/create-pending-generation.server'
import { uploadLibraryImagesToFal } from '#/lib/server/fal-image-inputs.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export interface GenerateVideoInput {
  imageId: string
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
  if (!model.aspectRatios.includes(aspectRatio)) {
    throw new Error(`Unsupported aspect ratio: ${aspectRatio}`)
  }

  const source = first(
    await sql<Array<{ id: string; title: string }>>`
      select id, title from user_images
      where id = ${imageId} and user_id = ${userId} and deleted_at is null
        and status = 'completed'
    `,
  )
  if (!source) throw new Error('Source image not found')

  const estimatedCostCents = estimateCostCents(model, duration)

  const { recordId } = await createPendingGeneration({
    userId,
    origin: 'images',
    source: 'ai_video',
    generationType: 'image_to_video',
    falModelId: model.endpoint,
    prompt: trimmed,
    aspectRatio,
    extraMetadata: {
      // Read back by `processVideoResult` for the row's title, so a
      // `.server.ts` module never has to import the route-owned catalog.
      model_label: model.label,
      source_image_id: imageId,
      duration_seconds: duration,
      resolution: model.resolution,
      estimated_cost_cents: estimatedCostCents,
    },
  })

  try {
    // The bucket is private (#226), so FAL cannot fetch our URL -- the bytes go
    // up to FAL's own storage first. Same seam the image paths use.
    const [uploadedUrl] = await uploadLibraryImagesToFal([imageId], userId)
    if (!uploadedUrl) throw new Error('Could not read the source image')

    const { request_id } = await fal.queue.submit(model.endpoint, {
      input: {
        prompt: trimmed,
        image_url: uploadedUrl,
        duration,
        aspect_ratio: aspectRatio,
        resolution: model.resolution,
        generate_audio: true,
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
