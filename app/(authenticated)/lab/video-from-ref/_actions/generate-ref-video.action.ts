'use server'

import {
  DURATIONS,
  ENDPOINT,
  MAX_IMAGES,
  RESOLUTION,
  estimateCostCents,
} from '../seedance'
import { fal } from '#/lib/server/fal-client.server'
import { withNetworkRetry } from '#/lib/server/fal-retry.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '#/lib/server/create-pending-generation.server'
import { uploadLibraryImagesToFal } from '#/lib/server/fal-image-inputs.server'

export interface GenerateRefVideoInput {
  imageIds: Array<string>
  prompt: string
  duration: string
  aspectRatio: string
}

/**
 * Queue one clip from up to nine reference images (#462).
 *
 * Shaped like `generateVideo`: reserve the row before FAL is contacted, attach
 * the request id, and let `check-pending-generations.action.ts` settle it.
 * `source: 'ai_video'` is what routes the result to `processVideoResult`, so
 * the poster, the end frame and the stored mp4 all come for free.
 *
 * `origin: 'images'` is the same small lie Video already tells -- a lab page
 * does not get a migration, so the clip files itself with the library.
 */
export async function generateRefVideo({
  imageIds,
  prompt,
  duration,
  aspectRatio,
}: GenerateRefVideoInput): Promise<{ recordId: string }> {
  const { userId } = await resolveAuth()

  const trimmed = prompt.trim()
  if (!trimmed) throw new Error('A prompt is required')
  if (imageIds.length === 0) throw new Error('At least one image is required')
  if (imageIds.length > MAX_IMAGES) {
    throw new Error(`At most ${MAX_IMAGES} images`)
  }
  if (!DURATIONS.includes(duration as (typeof DURATIONS)[number])) {
    throw new Error(`Unsupported duration: ${duration}`)
  }

  // One statement for every id, as the video route does: proving them one at a
  // time is N round trips for the same answer, and a partial check would let an
  // unreadable image fail after the row was reserved.
  const found = await sql<Array<{ id: string }>>`
    select id from user_images
    where id in ${sql(imageIds)} and user_id = ${userId}
      and deleted_at is null and status = 'completed'
  `
  if (found.length !== new Set(imageIds).size) {
    throw new Error('Reference image not found')
  }

  const estimatedCostCents = estimateCostCents(duration)

  const { recordId } = await createPendingGeneration({
    userId,
    origin: 'images',
    source: 'ai_video',
    generationType: 'image_to_video',
    falModelId: ENDPOINT,
    prompt: trimmed,
    aspectRatio,
    title: 'Ref Video',
    extraMetadata: {
      model_label: 'Seedance 2.0 · reference-to-video',
      reference_image_ids: imageIds,
      duration_seconds: Number(duration),
      resolution: RESOLUTION,
      estimated_cost_cents: estimatedCostCents,
    },
  })

  try {
    // The bucket is private (#226), so FAL cannot fetch our URLs -- the bytes
    // go to FAL's own storage first. **Order is the contract**: the helper
    // resolves by the ids given rather than by whatever the database returned,
    // and this array's order is what `@Image1`..`@ImageN` mean.
    const uploaded = await uploadLibraryImagesToFal(imageIds, userId)

    const { request_id } = await withNetworkRetry('queue.submit', () =>
      fal.queue.submit(ENDPOINT, {
        input: {
          prompt: trimmed,
          image_urls: uploaded,
          duration,
          aspect_ratio: aspectRatio,
          resolution: RESOLUTION,
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

export interface RefVideoRecord {
  id: string
  status: string
  generation_error: string | null
  created_at: string
  width: number | null
  height: number | null
}

/** The rows this session queued, by id. Nothing persists across a navigation. */
export async function listRefVideos(
  ids: Array<string>,
): Promise<Array<RefVideoRecord>> {
  const { userId } = await resolveAuth()
  if (ids.length === 0) return []

  const rows = await sql<Array<RefVideoRecord>>`
    select id, status, generation_error,
           to_json(created_at)#>>'{}' as created_at,
           width, height
    from user_images
    where id in ${sql(ids)} and user_id = ${userId}
      and deleted_at is null
    order by created_at desc
  `

  return rows as unknown as Array<RefVideoRecord>
}
