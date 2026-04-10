import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'
import {
  checkAndDeductCredits,
  withCreditRefund,
} from '@/features/credits/server/check-credits.server'
import { DEFAULT_VIDEO_MODEL } from '@/features/ai-video/video-models'
import { fetchVideoModelSchema } from '@/features/ai-video/server/fal-video-schema.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { checkRateLimit } from '@/lib/server/rate-limit.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateFlfVideoInput {
  firstFrameRecordId: string
  lastFrameRecordId?: string
  prompt: string
  accessToken: string
  duration?: string
  cfgScale?: number
  negativePrompt?: string
  videoModel?: string
}

async function uploadFrameToFal(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const signedUrl = await createImageStorage(supabase).getUrl(storagePath)

  if (!signedUrl) {
    throw new Error('Failed to create signed URL for frame')
  }

  const res = await fetch(signedUrl)
  if (!res.ok) throw new Error('Failed to fetch frame image')

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

export const generateFlfVideo = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateFlfVideoInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    await checkRateLimit(user.id, 'video')

    const { firstFrameRecordId, lastFrameRecordId, prompt } = data

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'video_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    return withCreditRefund(
      creditResult.userId,
      creditResult.cost,
      'video_gen',
      async () => {
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.VITE_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${data.accessToken}` },
            },
          },
        )

        // Fetch frame records
        const frameIds = [firstFrameRecordId]
        if (lastFrameRecordId) frameIds.push(lastFrameRecordId)

        const { data: frames } = await supabase
          .from('user_images')
          .select('id, storage_path, generation_metadata')
          .in('id', frameIds)
          .eq('user_id', user.id)
          .eq('status', 'completed')

        const firstFrame = frames?.find((f) => f.id === firstFrameRecordId)
        const lastFrame = lastFrameRecordId
          ? frames?.find((f) => f.id === lastFrameRecordId)
          : null

        if (!firstFrame?.storage_path) {
          throw new Error('First frame not found or not completed')
        }
        if (lastFrameRecordId && !lastFrame?.storage_path) {
          throw new Error('Last frame not found or not completed')
        }

        // Prefer cropped_storage_path from metadata (guaranteed ≥ 300x300) to handle
        // old records where storage_path points to a potentially-small original.
        const firstFramePath =
          (
            firstFrame.generation_metadata as {
              cropped_storage_path?: string
            } | null
          )?.cropped_storage_path ?? firstFrame.storage_path

        const lastFramePath = lastFrame
          ? ((
              lastFrame.generation_metadata as {
                cropped_storage_path?: string
              } | null
            )?.cropped_storage_path ?? lastFrame.storage_path)
          : null

        // Upload frames to FAL storage
        const startImageUrl = await uploadFrameToFal(supabase, firstFramePath)
        const endImageUrl = lastFramePath
          ? await uploadFrameToFal(supabase, lastFramePath)
          : null

        const videoModel = data.videoModel || DEFAULT_VIDEO_MODEL

        // Fetch schema to build correct params automatically
        const schema = await fetchVideoModelSchema(videoModel)

        const falInput: Record<string, unknown> = {}

        // Prompt — @Image references are for the `elements` array, not start/end URLs.
        // Since we use start_image_url/end_image_url, just pass the prompt directly.
        falInput.prompt = prompt || 'Natural motion with cinematic quality'

        // Image params — use schema-detected parameter names
        falInput[schema.imageParam] = startImageUrl
        if (endImageUrl && schema.endImageParam) {
          falInput[schema.endImageParam] = endImageUrl
        }

        // Duration — respect integer vs string type from schema
        const duration = data.duration || '5'
        falInput.duration = schema.durationIsInteger
          ? parseInt(duration, 10)
          : duration

        // Optional params — only send if the model supports them
        if (data.cfgScale !== undefined && schema.supportsCfgScale) {
          falInput.cfg_scale = data.cfgScale
        }
        if (data.negativePrompt && schema.supportsNegativePrompt) {
          falInput.negative_prompt = data.negativePrompt
        }

        // Log what we're sending for debugging model-specific failures
        const debugInput = {
          ...falInput,
          // Truncate URLs to keep logs readable
          [schema.imageParam]: '[start_image]',
          ...(schema.endImageParam && falInput[schema.endImageParam]
            ? { [schema.endImageParam]: '[end_image]' }
            : {}),
        }
        console.log(
          `[video-gen] model=${videoModel} schema=${JSON.stringify({ imageParam: schema.imageParam, endImageParam: schema.endImageParam, durationIsInteger: schema.durationIsInteger })} input=${JSON.stringify(debugInput)}`,
        )

        const webhookUrl = getFalWebhookUrl()
        const { request_id } = await fal.queue.submit(videoModel, {
          input: falInput as Record<string, unknown> & {
            prompt: string
          },
          ...(webhookUrl ? { webhookUrl } : {}),
        })

        const { data: record, error: insertError } = await supabase
          .from('user_images')
          .insert({
            user_id: user.id,
            request_id,
            status: 'pending',
            source: 'ai_video',
            title: 'Generating video...',
            generation_metadata: {
              model: videoModel,
              prompt,
              transition_prompt: prompt || null,
              first_frame_id: firstFrameRecordId,
              last_frame_id: lastFrameRecordId || null,
              submitted_at: new Date().toISOString(),
              fal_input_debug: debugInput,
            },
          })
          .select()
          .single()

        if (insertError) {
          throw new Error(
            `Failed to create video record: ${insertError.message}`,
          )
        }

        return { recordId: record.id, request_id }
      },
    )
  })
