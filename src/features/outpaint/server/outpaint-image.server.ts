import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import sharp from 'sharp'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'
import { RATIO_TO_SIZE } from '@/features/ai-images/constants'

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
  offset?: { x: number; y: number }
  prompt?: string
}

/**
 * Compose source image at an offset position on a target-sized canvas.
 * Supports offsets outside 0–1 (image partially outside frame).
 * Visible portion is composited; empty areas are filled with neutral gray.
 */
async function composeAtOffset(
  sourceBuffer: Buffer,
  aspectRatio: string,
  offset: { x: number; y: number },
): Promise<Buffer> {
  const target =
    RATIO_TO_SIZE[aspectRatio] ??
    (() => {
      throw new Error(`Unknown aspect ratio: ${aspectRatio}`)
    })()

  const meta = await sharp(sourceBuffer).metadata()
  const srcW = meta.width || 1
  const srcH = meta.height || 1

  // Scale source to fit within target (fill one axis)
  const scaleX = target.width / srcW
  const scaleY = target.height / srcH
  const scale = Math.min(scaleX, scaleY)
  const fitW = Math.round(srcW * scale)
  const fitH = Math.round(srcH * scale)

  const resized = await sharp(sourceBuffer)
    .resize(fitW, fitH, { fit: 'fill' })
    .toBuffer()

  const spareX = target.width - fitW
  const spareY = target.height - fitH

  // offset can be outside 0–1 when image is dragged past bounds
  const left = Math.round(offset.x * spareX)
  const top = Math.round(offset.y * spareY)

  // If offset is within 0–1, use the fast edge-repeat path
  if (
    left >= 0 &&
    top >= 0 &&
    left + fitW <= target.width &&
    top + fitH <= target.height
  ) {
    const composed = await sharp(resized)
      .extend({
        left,
        top,
        right: target.width - fitW - left,
        bottom: target.height - fitH - top,
        extendWith: 'repeat',
      })
      .png()
      .toBuffer()
    return composed
  }

  // Out-of-bounds: crop the visible portion of the resized image
  let cropLeft = 0
  let cropTop = 0
  let cropW = fitW
  let cropH = fitH
  let compLeft = left
  let compTop = top

  if (left < 0) {
    cropLeft = -left
    cropW -= cropLeft
    compLeft = 0
  }
  if (top < 0) {
    cropTop = -top
    cropH -= cropTop
    compTop = 0
  }
  if (compLeft + cropW > target.width) {
    cropW = target.width - compLeft
  }
  if (compTop + cropH > target.height) {
    cropH = target.height - compTop
  }

  // Ensure valid dimensions
  cropW = Math.max(1, cropW)
  cropH = Math.max(1, cropH)

  const cropped = await sharp(resized)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .toBuffer()

  const composed = await sharp({
    create: {
      width: target.width,
      height: target.height,
      channels: 4,
      background: { r: 128, g: 128, b: 128, alpha: 255 },
    },
  })
    .composite([{ input: cropped, left: compLeft, top: compTop }])
    .png()
    .toBuffer()

  return composed
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

    // Source image URL is a signed Supabase URL or data URL — fetch into buffer
    const imageRes = await fetch(data.sourceImageUrl)
    const buffer = Buffer.from(await imageRes.arrayBuffer())

    let uploadBuffer: Buffer
    let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
      'image/jpeg'

    if (data.offset) {
      // Compose at offset — always outputs PNG
      uploadBuffer = await composeAtOffset(
        buffer,
        data.aspectRatio,
        data.offset,
      )
      mimeType = 'image/png'
    } else {
      // Center (default behavior) — pass through original
      uploadBuffer = buffer
      const bytes = new Uint8Array(buffer)
      if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        mimeType = 'image/png'
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
        mimeType = 'image/webp'
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
        mimeType = 'image/gif'
      }
    }

    const falImageUrl = await fal.storage.upload(
      new Blob([uploadBuffer], { type: mimeType }),
    )

    const isNanoBanana = data.model.includes('nano-banana')
    const effectivePrompt = data.prompt || OUTPAINT_PROMPT

    let falInput: Record<string, unknown>

    if (isNanoBanana) {
      const supported = NANO_BANANA_RATIOS.has(data.aspectRatio)
      // For nano-banana with a supported ratio and no custom prompt,
      // a minimal prompt lets the model infer extension direction from
      // the source dimensions vs target aspect ratio.
      const prompt = data.prompt
        ? data.prompt
        : supported
          ? 'Extend image'
          : `Extend this image to fill a ${data.aspectRatio} frame`

      falInput = {
        prompt,
        image_urls: [falImageUrl],
        aspect_ratio: supported ? data.aspectRatio : 'auto',
        safety_tolerance: 6,
      }
    } else {
      falInput = await buildFalInput({
        modelId: data.model,
        prompt: effectivePrompt,
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
      prompt: effectivePrompt,
      aspectRatio: data.aspectRatio,
    })

    return { recordId }
  })
