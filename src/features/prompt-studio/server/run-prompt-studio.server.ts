import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { TEXT_MODEL_MAP } from '../text-models'
import type { ModelResult } from '../types'
import { requireAuth } from '@/lib/server/auth.server'

export const fetchImageBase64 = createServerFn({ method: 'POST' })
  .inputValidator((data: { url: string; accessToken: string }) => data)
  .handler(async ({ data }): Promise<string> => {
    await requireAuth(data.accessToken)
    const res = await fetch(data.url)
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/png'
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  })

interface RunPromptStudioInput {
  prompt: string
  systemPrompt: string
  modelIds: Array<string>
  accessToken: string
  imageBase64?: string | null
}

interface RunSingleModelInput {
  prompt: string
  systemPrompt: string
  modelId: string
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

      return {
        modelId: data.modelIds[i],
        text: null,
        error: extractErrorMessage(result.reason),
        durationMs: 0,
      }
    })
  })

function extractErrorMessage(err: unknown): string {
  let message = 'Unknown error'
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause
    if (cause instanceof Error) {
      message = cause.message
    } else {
      message = err.message
    }
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
        if (responseBody.length < 200) message = responseBody
      }
    }
  }
  return message
}

export const runSingleModel = createServerFn({ method: 'POST' })
  .inputValidator((data: RunSingleModelInput) => data)
  .handler(async ({ data }): Promise<ModelResult> => {
    await requireAuth(data.accessToken)

    const model = TEXT_MODEL_MAP[data.modelId]
    if (!model) {
      return {
        modelId: data.modelId,
        text: null,
        error: 'Unknown model',
        durationMs: 0,
      }
    }

    const start = Date.now()
    const systemOpt = data.systemPrompt ? { system: data.systemPrompt } : {}

    try {
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

      return {
        modelId: data.modelId,
        text: text.trim(),
        error: null,
        durationMs: Date.now() - start,
      }
    } catch (err) {
      return {
        modelId: data.modelId,
        text: null,
        error: extractErrorMessage(err),
        durationMs: Date.now() - start,
      }
    }
  })
