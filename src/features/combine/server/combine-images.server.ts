import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'
import { fetchAndUploadToFal } from '@/lib/server/fal-image-upload.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'

interface CombineImagesInput {
  accessToken: string
  sourceImageUrls: Array<string>
  prompt: string
  aspectRatio: string
  model: string
  enhancedPrompt?: string
  originalPrompt?: string
}

export const combineImages = createServerFn({ method: 'POST' })
  .inputValidator((data: CombineImagesInput) => data)
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

    const falUrls = await Promise.all(
      data.sourceImageUrls.map(fetchAndUploadToFal),
    )

    const falInput = await buildFalInput({
      modelId: data.model,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio,
      imageUrls: falUrls,
      safetyLevel: 'permissive',
    })

    const { request_id } = await (fal.queue.submit as any)(data.model, {
      input: falInput,
    })

    const { recordId } = await createPendingGeneration({
      accessToken: data.accessToken,
      userId: user.id,
      requestId: request_id,
      generationType: 'combine',
      falModelId: data.model,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio,
      extraMetadata: {
        ...(data.enhancedPrompt
          ? { enhanced_prompt: data.enhancedPrompt }
          : {}),
        ...(data.originalPrompt
          ? { original_prompt: data.originalPrompt }
          : {}),
      },
    })

    return { recordId }
  })
