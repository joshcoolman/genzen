import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export const BRAINSTORM_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence'

export const BRAINSTORM_MODELS = {
  schnell: 'fal-ai/flux/schnell',
  dev: 'fal-ai/flux/dev',
} as const

export type BrainstormModelKey = keyof typeof BRAINSTORM_MODELS

const DEFAULT_MODEL: BrainstormModelKey = 'schnell'

const REWRITE_SYSTEM = `Improve this image generation prompt. Return ONLY the improved prompt. No quotes, no explanation.`

interface CheckBrainstormInput {
  accessToken: string
  requestIds: Array<string>
  model?: BrainstormModelKey
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
      model: ai.haiku,
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
      model: ai.haiku,
      system: `You are editing an image generation prompt. The user wants this change: ${data.editInstruction}. Revise the prompt to incorporate the edit. Return ONLY the revised prompt, no quotes or explanation.`,
      prompt: data.prompt,
    })

    return { prompt: text.trim() }
  })

interface RegenerateBrainstormInput {
  accessToken: string
  prompts: Array<string>
  model?: BrainstormModelKey
}

export const regenerateBrainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: RegenerateBrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const modelKey = data.model ?? DEFAULT_MODEL
    const modelId = BRAINSTORM_MODELS[modelKey]
    const submissions = await Promise.all(
      data.prompts.map((prompt) =>
        fal.queue.submit(modelId, {
          input: {
            prompt,
            enable_safety_checker: false,
            safety_tolerance: 6,
            ...(modelKey === 'dev'
              ? { num_inference_steps: 28, guidance_scale: 3.5 }
              : {}),
          },
        }),
      ),
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

    const modelId = BRAINSTORM_MODELS[data.model ?? DEFAULT_MODEL]
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
