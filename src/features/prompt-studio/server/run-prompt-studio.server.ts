import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { TEXT_MODEL_MAP } from '../text-models'
import type { ModelResult } from '../types'
import { requireAuth } from '@/lib/server/auth.server'

interface RunPromptStudioInput {
  prompt: string
  systemPrompt: string
  modelIds: Array<string>
  accessToken: string
}

export const runPromptStudio = createServerFn({ method: 'POST' })
  .inputValidator((data: RunPromptStudioInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const results = await Promise.allSettled(
      data.modelIds.map(async (modelId): Promise<ModelResult> => {
        const model = TEXT_MODEL_MAP[modelId]
        if (!model) {
          return { modelId, text: null, error: 'Unknown model', durationMs: 0 }
        }

        const start = Date.now()
        const { text } = await generateText({
          model,
          ...(data.systemPrompt ? { system: data.systemPrompt } : {}),
          prompt: data.prompt,
        })
        const durationMs = Date.now() - start

        return { modelId, text: text.trim(), error: null, durationMs }
      }),
    )

    return results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value
      return {
        modelId: data.modelIds[i],
        text: null,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : 'Unknown error',
        durationMs: 0,
      }
    })
  })
