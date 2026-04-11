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
import {
  DEFAULT_VIDEO_MODEL,
  getVideoModelName,
} from '@/features/ai-video/video-models'
import { fetchVideoModelSchema } from '@/features/ai-video/server/fal-video-schema.server'
import { getFalWebhookUrl } from '@/lib/server/fal-webhook-url.server'
import { checkRateLimit } from '@/lib/server/rate-limit.server'
import { MULTISHOT_FAL_MODEL } from '@/features/multi-shot/types'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

// -- Shared input shapes ------------------------------------------------------

interface FlfSnapshot {
  method: 'flf'
  firstFrameRecordId: string
  firstFrameUrl?: string | null
  lastFrameRecordId?: string | null
  lastFrameUrl?: string | null
  prompt: string
  duration?: string
  cfgScale?: number
  negativePrompt?: string
  videoModel?: string
}

interface MultishotShotInput {
  id: string
  prompt: string
  duration: number
}

interface MultishotElementInput {
  id: string
  frontalImageUrl: string
  label: string
}

interface MultishotSnapshot {
  method: 'multishot'
  startImageUrl: string
  shots: Array<MultishotShotInput>
  elements: Array<MultishotElementInput>
  aspectRatio: '16:9' | '9:16' | '1:1'
  shotType: 'customize' | 'intelligent'
  generateAudio: boolean
}

type GenerateVideoInput = {
  accessToken: string
  parentId?: string | null
  /**
   * Optional client-minted UUID. When provided, the inserted user_images row
   * uses this as its PK so an optimistic card pushed on the client collapses
   * into the real row via realtime id-equality dedupe.
   */
  id?: string
} & (FlfSnapshot | MultishotSnapshot)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateClientId(id: string | undefined): string | undefined {
  if (id === undefined) return undefined
  if (!UUID_RE.test(id)) throw new Error('Invalid client-supplied id')
  return id
}

// -- FAL upload helpers -------------------------------------------------------

async function uploadFrameToFal(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const signedUrl = await createImageStorage(supabase).getUrl(storagePath)
  if (!signedUrl) throw new Error('Failed to create signed URL for frame')

  const res = await fetch(signedUrl)
  if (!res.ok) throw new Error('Failed to fetch frame image')

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

async function uploadUrlToFal(imageUrl: string): Promise<string> {
  if (imageUrl.includes('fal.media') || imageUrl.includes('fal-cdn')) {
    return imageUrl
  }

  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Failed to fetch image: ${imageUrl}`)

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

// -- Server function ----------------------------------------------------------

export const generateVideo = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateVideoInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    validateClientId(data.id)
    await checkRateLimit(user.id, 'video')

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
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

    if (data.method === 'flf') {
      return generateFlf(supabase, user.id, data)
    } else {
      return generateMultishot(supabase, user.id, data)
    }
  })

// -- FLF branch ---------------------------------------------------------------

async function generateFlf(
  supabase: SupabaseClient,
  userId: string,
  data: GenerateVideoInput & FlfSnapshot,
) {
  const creditResult = await checkAndDeductCredits(
    data.accessToken,
    'video_gen',
  )
  if (!creditResult.allowed) throw new Error('Insufficient credits')

  return withCreditRefund(
    creditResult.userId,
    creditResult.cost,
    'video_gen',
    async () => {
      const frameIds = [data.firstFrameRecordId]
      if (data.lastFrameRecordId) frameIds.push(data.lastFrameRecordId)

      const { data: frames } = await supabase
        .from('user_images')
        .select('id, storage_path, generation_metadata')
        .in('id', frameIds)
        .eq('user_id', userId)
        .eq('status', 'completed')

      const firstFrame = frames?.find((f) => f.id === data.firstFrameRecordId)
      const lastFrame = data.lastFrameRecordId
        ? frames?.find((f) => f.id === data.lastFrameRecordId)
        : null

      if (!firstFrame?.storage_path) {
        throw new Error('First frame not found or not completed')
      }
      if (data.lastFrameRecordId && !lastFrame?.storage_path) {
        throw new Error('Last frame not found or not completed')
      }

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

      const startImageUrl = await uploadFrameToFal(supabase, firstFramePath)
      const endImageUrl = lastFramePath
        ? await uploadFrameToFal(supabase, lastFramePath)
        : null

      const videoModel = data.videoModel || DEFAULT_VIDEO_MODEL
      const schema = await fetchVideoModelSchema(videoModel)

      const falInput: Record<string, unknown> = {}
      falInput.prompt = data.prompt || 'Natural motion with cinematic quality'
      falInput[schema.imageParam] = startImageUrl
      if (endImageUrl && schema.endImageParam) {
        falInput[schema.endImageParam] = endImageUrl
      }

      const duration = data.duration || '5'
      falInput.duration = schema.durationIsInteger
        ? parseInt(duration, 10)
        : duration

      if (data.cfgScale !== undefined && schema.supportsCfgScale) {
        falInput.cfg_scale = data.cfgScale
      }
      if (data.negativePrompt && schema.supportsNegativePrompt) {
        falInput.negative_prompt = data.negativePrompt
      }

      const debugInput = {
        ...falInput,
        [schema.imageParam]: '[start_image]',
        ...(schema.endImageParam && falInput[schema.endImageParam]
          ? { [schema.endImageParam]: '[end_image]' }
          : {}),
      }
      console.log(
        `[generate-video flf] model=${videoModel} input=${JSON.stringify(debugInput)}`,
      )

      const webhookUrl = getFalWebhookUrl()
      const { request_id } = await fal.queue.submit(videoModel, {
        input: falInput as Record<string, unknown> & { prompt: string },
        ...(webhookUrl ? { webhookUrl } : {}),
      })

      const { data: record, error: insertError } = await supabase
        .from('user_images')
        .insert({
          ...(data.id ? { id: data.id } : {}),
          user_id: userId,
          request_id,
          status: 'pending',
          source: 'ai_video',
          title: getVideoModelName(videoModel),
          generation_metadata: {
            method: 'flf',
            parent_id: data.parentId ?? null,
            model: videoModel,
            prompt: data.prompt,
            transition_prompt: data.prompt || null,
            first_frame_id: data.firstFrameRecordId,
            first_frame_url: data.firstFrameUrl ?? null,
            last_frame_id: data.lastFrameRecordId ?? null,
            last_frame_url: data.lastFrameUrl ?? null,
            duration,
            cfg_scale: data.cfgScale ?? null,
            negative_prompt: data.negativePrompt ?? null,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create video record: ${insertError.message}`)
      }

      return { recordId: record.id, requestId: request_id }
    },
  )
}

// -- Multishot branch ---------------------------------------------------------

async function generateMultishot(
  supabase: SupabaseClient,
  userId: string,
  data: GenerateVideoInput & MultishotSnapshot,
) {
  if (data.shots.length === 0) throw new Error('At least one shot is required')
  const totalDuration = data.shots.reduce((sum, s) => sum + s.duration, 0)
  if (totalDuration > 15) throw new Error('Total duration exceeds 15 seconds')
  if (!data.startImageUrl) {
    throw new Error('A start image is required for multi-shot generation')
  }

  const creditResult = await checkAndDeductCredits(
    data.accessToken,
    'multishot_gen',
  )
  if (!creditResult.allowed) throw new Error('Insufficient credits')

  return withCreditRefund(
    creditResult.userId,
    creditResult.cost,
    'multishot_gen',
    async () => {
      const falElements = await Promise.all(
        data.elements.map(async (el, i) => {
          const imageUrl = await uploadUrlToFal(el.frontalImageUrl)
          return {
            frontal_image_url: imageUrl,
            reference_image_urls: [imageUrl],
            label: el.label || `@Element${i + 1}`,
          }
        }),
      )

      const startImageUrl = await uploadUrlToFal(data.startImageUrl)

      const falInput: Record<string, unknown> = {
        multi_prompt: data.shots.map((s) => ({
          prompt: s.prompt,
          duration: String(s.duration),
        })),
        shot_type: data.shotType,
        generate_audio: data.generateAudio,
        start_image_url: startImageUrl,
      }

      if (falElements.length > 0) {
        falInput.elements = falElements
      }

      console.log(
        `[generate-video multishot] shots=${data.shots.length} elements=${data.elements.length} total=${totalDuration}s`,
      )

      const webhookUrl = getFalWebhookUrl()
      const { request_id } = await fal.queue.submit(MULTISHOT_FAL_MODEL, {
        input: falInput as Record<string, unknown> & { multi_prompt: unknown },
        ...(webhookUrl ? { webhookUrl } : {}),
      })

      const { data: record, error: insertError } = await supabase
        .from('user_images')
        .insert({
          ...(data.id ? { id: data.id } : {}),
          user_id: userId,
          request_id,
          status: 'pending',
          source: 'ai_video',
          title: getVideoModelName(MULTISHOT_FAL_MODEL),
          generation_metadata: {
            method: 'multishot',
            type: 'multishot', // backward-compat for any existing listeners
            parent_id: data.parentId ?? null,
            model: MULTISHOT_FAL_MODEL,
            shots: data.shots,
            elements: data.elements,
            start_image_url: data.startImageUrl,
            aspect_ratio: data.aspectRatio,
            shot_type: data.shotType,
            generate_audio: data.generateAudio,
            shot_count: data.shots.length,
            total_duration: totalDuration,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create video record: ${insertError.message}`)
      }

      return { recordId: record.id, requestId: request_id }
    },
  )
}
