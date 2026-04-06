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
  imageBase64?: string | null
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

        const systemOpt = data.systemPrompt ? { system: data.systemPrompt } : {}

        const { text } = data.imageBase64
          ? await generateText({
              model,
              ...systemOpt,
              messages: [
                {
                  role: 'user' as const,
                  content: [
                    { type: 'image' as const, image: data.imageBase64 },
                    { type: 'text' as const, text: data.prompt },
                  ],
                },
              ],
            })
          : await generateText({
              model,
              ...systemOpt,
              prompt: data.prompt,
            })
        const durationMs = Date.now() - start

        return { modelId, text: text.trim(), error: null, durationMs }
      }),
    )

    return results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value

      const err = result.reason
      let message = 'Unknown error'
      if (err instanceof Error) {
        // Vercel AI SDK wraps provider errors -- dig into cause chain
        const cause = (err as Error & { cause?: unknown }).cause
        if (cause instanceof Error) {
          message = cause.message
        } else {
          message = err.message
        }
        // Append response body if available (OpenRouter includes details)
        const responseBody = (err as unknown as Record<string, unknown>)
          .responseBody
        if (typeof responseBody === 'string') {
          try {
            const parsed = JSON.parse(responseBody)
            const detail =
              parsed?.error?.message || parsed?.error || parsed?.message
            if (detail && typeof detail === 'string') {
              message = detail
            }
          } catch {
            // not JSON, use as-is if short
            if (responseBody.length < 200) message = responseBody
          }
        }
      }

      return {
        modelId: data.modelIds[i],
        text: null,
        error: message,
        durationMs: 0,
      }
    })
  })
