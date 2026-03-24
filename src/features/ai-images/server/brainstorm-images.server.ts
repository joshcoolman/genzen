import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { generateText } from 'ai'
import { buildFalInput } from './fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export const BRAINSTORM_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence'

export const BRAINSTORM_MODELS = {
  kontextDev: 'fal-ai/flux-kontext/dev',
  schnell: 'fal-ai/flux/schnell',
} as const

export type BrainstormModelKey = keyof typeof BRAINSTORM_MODELS

const DEFAULT_MODEL: BrainstormModelKey = 'kontextDev'

// Accepts either a BrainstormModelKey or a direct FAL model ID
function resolveBrainstormModelId(model?: BrainstormModelKey | string): string {
  if (!model) return BRAINSTORM_MODELS[DEFAULT_MODEL]
  if (model in BRAINSTORM_MODELS)
    return BRAINSTORM_MODELS[model as BrainstormModelKey]
  return model // direct model ID passthrough
}

const REWRITE_SYSTEM = `Improve this image generation prompt. Return ONLY the improved prompt. No quotes, no explanation.`

interface CheckBrainstormInput {
  accessToken: string
  requestIds: Array<string>
  model?: BrainstormModelKey | string
}

interface RewritePromptInput {
  accessToken: string
  prompt: string
}

export const rewritePrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: RewritePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const { text } = await generateText({
      model: ai.fast,
      system: REWRITE_SYSTEM,
      prompt: data.prompt,
    })

    return { prompt: text.trim() }
  })

interface EditPromptInput {
  accessToken: string
  prompt: string
  editInstruction: string
}

export const editPrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: EditPromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const { text } = await generateText({
      model: ai.fast,
      system: `You are editing an image generation prompt. The user wants this change: ${data.editInstruction}. Revise the prompt to incorporate the edit. Return ONLY the revised prompt, no quotes or explanation.`,
      prompt: data.prompt,
    })

    return { prompt: text.trim() }
  })

interface RegenerateBrainstormInput {
  accessToken: string
  prompts: Array<string>
  model?: BrainstormModelKey | string
  sourceImageUrl?: string
}

export const regenerateBrainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: RegenerateBrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const modelId = resolveBrainstormModelId(data.model)
    const isKontextDev = modelId === BRAINSTORM_MODELS.kontextDev
    const submissions = await Promise.all(
      data.prompts.map(async (prompt) => {
        const falInput = await buildFalInput({
          modelId,
          prompt,
          safetyLevel: 'permissive',
          ...(data.sourceImageUrl && isKontextDev
            ? { imageUrls: [data.sourceImageUrl] }
            : {}),
          extraParams: isKontextDev
            ? { num_inference_steps: 28, guidance_scale: 3.5 }
            : undefined,
        })
        return (fal.queue.submit as any)(modelId, { input: falInput })
      }),
    )

    return {
      requestIds: submissions.map((s) => s.request_id),
    }
  })

export const checkBrainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckBrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const modelId = resolveBrainstormModelId(data.model)
    const results = await Promise.all(
      data.requestIds.map(async (requestId) => {
        try {
          const status = await fal.queue.status(modelId, {
            requestId,
            logs: false,
          })

          if (status.status === 'COMPLETED') {
            const result = await fal.queue.result(modelId, {
              requestId,
            })
            const images = (result.data as { images: Array<{ url: string }> })
              .images
            const url = images[0]?.url ?? null
            return { requestId, status: 'completed' as const, url }
          }

          if (status.status === 'FAILED') {
            return { requestId, status: 'failed' as const, url: null }
          }

          return { requestId, status: 'pending' as const, url: null }
        } catch {
          return { requestId, status: 'failed' as const, url: null }
        }
      }),
    )

    return results
  })
