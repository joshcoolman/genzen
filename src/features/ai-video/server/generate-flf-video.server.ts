import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { tasks } from '@trigger.dev/sdk/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { DEFAULT_VIDEO_MODEL } from '@/features/ai-video/video-models'
import { fetchVideoModelSchema } from '@/features/ai-video/server/fal-video-schema.server'

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
  const { data: signedUrlData } = await supabase.storage
    .from('user-images')
    .createSignedUrl(storagePath, 3600)

  if (!signedUrlData?.signedUrl) {
    throw new Error('Failed to create signed URL for frame')
  }

  const res = await fetch(signedUrlData.signedUrl)
  if (!res.ok) throw new Error('Failed to fetch frame image')

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

function isKlingModel(modelId: string): boolean {
  return modelId.includes('kling-video')
}

export const generateFlfVideo = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateFlfVideoInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

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
      .select('id, storage_path')
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

    // Upload frames to FAL storage
    const startImageUrl = await uploadFrameToFal(
      supabase,
      firstFrame.storage_path,
    )
    const endImageUrl = lastFrame?.storage_path
      ? await uploadFrameToFal(supabase, lastFrame.storage_path)
      : null

    const videoModel = data.videoModel || DEFAULT_VIDEO_MODEL

    // Fetch schema to build correct params automatically
    const schema = await fetchVideoModelSchema(videoModel)

    const falInput: Record<string, unknown> = {}

    // Prompt — Kling models have special FLF prompt format
    if (isKlingModel(videoModel) && endImageUrl) {
      falInput.prompt = prompt
        ? `@Image1 ${prompt} @Image2`
        : '@Image1 smoothly transitions to @Image2 with fluid natural motion'
    } else {
      falInput.prompt = prompt || 'Natural motion with cinematic quality'
    }

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

    const { request_id } = await fal.queue.submit(videoModel, {
      input: falInput as Record<string, unknown> & {
        prompt: string
      },
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
      throw new Error(`Failed to create video record: ${insertError.message}`)
    }

    // Fire Trigger.dev task to poll FAL and process result
    const handle = await tasks.trigger('process-fal-video', {
      recordId: record.id,
      userId: user.id,
      falModelId: videoModel,
      requestId: request_id,
    })
    await supabase
      .from('user_images')
      .update({ task_id: handle.id })
      .eq('id', record.id)

    return { recordId: record.id, request_id }
  })
