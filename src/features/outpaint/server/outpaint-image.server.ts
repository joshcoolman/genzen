import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const OUTPAINT_PROMPT =
  'Seamlessly extend this image, continuing the existing scene, lighting, and style naturally into the expanded area.'

/** Aspect ratios the nano-banana edit models accept natively */
const NANO_BANANA_RATIOS = new Set([
  'auto',
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '9:16',
])

interface OutpaintImageInput {
  accessToken: string
  sourceImageUrl: string
  aspectRatio: string
  model: string
}

export const outpaintImage = createServerFn({ method: 'POST' })
  .inputValidator((data: OutpaintImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'image_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    // Source image URL is a signed Supabase URL or data URL — fetch and upload to FAL
    const imageRes = await fetch(data.sourceImageUrl)
    const buffer = await imageRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
      'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      mimeType = 'image/png'
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
      mimeType = 'image/webp'
    } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
      mimeType = 'image/gif'
    }

    const falImageUrl = await fal.storage.upload(
      new Blob([buffer], { type: mimeType }),
    )

    const isNanoBanana = data.model.includes('nano-banana')

    let falInput: Record<string, unknown>

    if (isNanoBanana) {
      const supported = NANO_BANANA_RATIOS.has(data.aspectRatio)
      const prompt = supported
        ? OUTPAINT_PROMPT
        : `Seamlessly extend this image to fill a ${data.aspectRatio} frame, continuing the existing scene, lighting, and style naturally into the expanded area.`

      falInput = {
        prompt,
        image_urls: [falImageUrl],
        aspect_ratio: supported ? data.aspectRatio : 'auto',
        safety_tolerance: 6,
      }
    } else {
      falInput = await buildFalInput({
        modelId: data.model,
        prompt: OUTPAINT_PROMPT,
        aspectRatio: data.aspectRatio,
        imageUrls: [falImageUrl],
        safetyLevel: 'default',
      })
    }

    const { request_id } = await (fal.queue.submit as any)(data.model, {
      input: falInput,
    })

    const { recordId } = await createPendingGeneration({
      accessToken: data.accessToken,
      userId: user.id,
      requestId: request_id,
      generationType: 'outpaint',
      falModelId: data.model,
      prompt: OUTPAINT_PROMPT,
      aspectRatio: data.aspectRatio,
    })

    return { recordId }
  })
