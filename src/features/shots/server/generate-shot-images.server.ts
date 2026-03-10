import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const DEFAULT_MODEL = 'fal-ai/flux-pro/kontext'

interface GenerateShotImagesInput {
  prompts: Array<string>
  sourceImageUrl: string
  accessToken: string
  modelId?: string
}

export const generateShotImages = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateShotImagesInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const modelId = data.modelId ?? DEFAULT_MODEL

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Upload source image to FAL storage once
    const sourceResponse = await fetch(data.sourceImageUrl)
    if (!sourceResponse.ok) throw new Error('Failed to fetch source image')
    const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer())
    const contentType =
      sourceResponse.headers.get('content-type') ?? 'image/jpeg'
    const falSourceUrl = await fal.storage.upload(
      new Blob([sourceBuffer], { type: contentType }),
    )

    const results: Array<{ recordId: string; prompt: string }> = []

    for (const prompt of data.prompts) {
      const creditResult = await checkAndDeductCredits(
        data.accessToken,
        'image_gen',
      )
      if (!creditResult.allowed) {
        throw new Error('Insufficient credits')
      }

      const falInput = await buildFalInput({
        modelId,
        prompt,
        imageUrl: falSourceUrl,
      })

      const { request_id } = await (fal.queue.submit as any)(modelId, {
        input: falInput,
      })

      const { recordId } = await createPendingGeneration({
        accessToken: data.accessToken,
        userId: user.id,
        requestId: request_id,
        generationType: 'shot',
        falModelId: modelId,
        prompt,
        extraMetadata: {
          source_image_url: data.sourceImageUrl,
        },
      })

      results.push({ recordId, prompt })
    }

    return { results }
  })
