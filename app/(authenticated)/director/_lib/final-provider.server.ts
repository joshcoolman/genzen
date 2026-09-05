import 'server-only'
import { z } from 'zod'
import { mediaUrl } from '../clip-jobs.server'
import type { FinalStep } from './final-cut'
import { fal, submitFalOnce } from '#/lib/server/fal-client.server'
import { falFetch } from '#/lib/server/fal-fetch.server'
import { extractFalError } from '#/lib/server/fal-error.server'

export const FINAL_MODELS = {
  video: 'minimax/h3-max/reference-to-video',
  effects: 'fal-ai/mmaudio-v2',
  music: 'fal-ai/stable-audio-25/text-to-audio',
} as const

export async function runFinalProvider({
  steps,
  key,
  endpoint,
  input,
  checkpoint,
  alive,
}: {
  steps: Partial<Record<string, FinalStep>>
  key: string
  endpoint: string
  input: Record<string, unknown>
  checkpoint: () => Promise<void>
  alive: () => Promise<void>
}) {
  await alive()
  let step = steps[key]
  if (!step) {
    step = { endpoint, input }
    steps[key] = step
    await checkpoint()
    await alive()
    step.requestId = await submitFalOnce(endpoint, input)
    await checkpoint()
  }
  if (step.endpoint !== endpoint)
    throw new Error('Saved provider does not match this workflow version.')
  if (!step.requestId)
    throw new Error(
      'A provider submission has no receipt. It may have been charged; check FAL before starting another Final Cut.',
    )
  if (step.url) return step
  for (;;) {
    await alive()
    const status = await fal.queue.status(step.endpoint, {
      requestId: step.requestId,
      logs: false,
    })
    if (status.status === 'COMPLETED') break
    await new Promise((resolve) => setTimeout(resolve, 4000))
  }
  const result = await fal.queue
    .result(step.endpoint, {
      requestId: step.requestId,
    })
    .catch(async (error: unknown) => {
      const detail = extractFalError(error)
      if (['fal_400', 'fal_404', 'fal_422'].includes(detail.code)) {
        step.terminal = true
        await checkpoint()
      }
      throw new Error(detail.message)
    })
  const file = z.union([z.string(), z.object({ url: z.string() })])
  const data = z
    .object({ video: file.optional(), audio: file.optional() })
    .parse(result.data)
  const value = endpoint === FINAL_MODELS.music ? data.audio : data.video
  if (!value) throw new Error('The provider returned no media.')
  step.url = mediaUrl(typeof value === 'string' ? value : value.url)
  await checkpoint()
  return step
}

export async function downloadFinalMedia(url: string, type: string) {
  const response = await falFetch(mediaUrl(url), {
    redirect: 'error',
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok)
    throw new Error(
      `Provider media download failed (${response.status}). Resume to retry the download.`,
    )
  const limit = 200 * 1024 * 1024
  if (Number(response.headers.get('content-length')) > limit)
    throw new Error('Provider media exceeds 200 MB.')
  const chunks: Array<Uint8Array<ArrayBuffer>> = []
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Provider media is empty.')
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error('Provider media exceeds 200 MB.')
      chunks.push(new Uint8Array(value))
    }
  } finally {
    await reader.cancel()
  }
  if (!size) throw new Error('Provider media is empty.')
  return new Blob(chunks, { type })
}
