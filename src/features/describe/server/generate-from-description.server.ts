import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateFromDescriptionInput {
  prompt: string
  accessToken: string
  model?: string
  aspectRatio?: string
}

export const generateFromDescription = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateFromDescriptionInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!data.prompt.trim()) {
      throw new Error('Prompt is required')
    }

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

    const modelId = data.model ?? 'fal-ai/flux/schnell'

    const falInput = await buildFalInput({
      modelId,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio,
    })

    const { request_id } = await (fal.queue.submit as any)(modelId, {
      input: falInput,
    })

    const { recordId } = await createPendingGeneration({
      accessToken: data.accessToken,
      userId: user.id,
      requestId: request_id,
      generationType: 'describe',
      falModelId: modelId,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio,
    })

    return { recordId }
  })
