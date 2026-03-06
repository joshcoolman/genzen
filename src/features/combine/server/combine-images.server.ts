import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { RATIO_TO_SIZE } from '@/features/ai-images/constants'
import { EDIT_MODELS } from '@/features/ai-images/models'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface CombineImagesInput {
  accessToken: string
  sourceImageUrls: Array<string>
  prompt: string
  aspectRatio: string
  model: string
}

async function fetchAndUploadToFal(imageUrl: string): Promise<string> {
  const imageRes = await fetch(imageUrl)
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

  return fal.storage.upload(new Blob([buffer], { type: mimeType }))
}

export const combineImages = createServerFn({ method: 'POST' })
  .inputValidator((data: CombineImagesInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

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

    const falUrls = await Promise.all(
      data.sourceImageUrls.map(fetchAndUploadToFal),
    )

    const modelDef = EDIT_MODELS.find((m) => m.id === data.model)
    const sizeParam = modelDef?.sizeParam ?? 'aspect_ratio'

    const sizeParams =
      sizeParam === 'aspect_ratio'
        ? { aspect_ratio: data.aspectRatio }
        : {
            image_size: RATIO_TO_SIZE[data.aspectRatio] ?? RATIO_TO_SIZE['1:1'],
          }

    const result = await fal.subscribe(data.model, {
      input: {
        prompt: data.prompt,
        image_urls: falUrls,
        ...(data.model.includes('nano-banana') ? { safety_tolerance: 6 } : {}),
        ...sizeParams,
      },
    })

    const imageUrl = (result.data as { images?: Array<{ url: string }> })
      .images?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image returned from combine')
    }

    return { imageUrl }
  })
