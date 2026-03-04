import { createServerFn } from '@tanstack/react-start'
import type { FalApiModelsResponse, FalModel } from '../types'

interface FetchModelsInput {
  category?: string
  q?: string
  next_cursor?: string
}

export interface FetchModelsResult {
  data: Array<FalModel>
  next_cursor: string | null
  has_more: boolean
}

export const fetchModels = createServerFn({ method: 'GET' })
  .inputValidator((data: FetchModelsInput) => data)
  .handler(async ({ data }): Promise<FetchModelsResult> => {
    const params = new URLSearchParams()
    params.set('status', 'active')
    params.set('limit', '48')

    if (data.category && data.category !== 'all') {
      params.set('category', data.category)
    }
    if (data.q) {
      params.set('q', data.q)
    }
    if (data.next_cursor) {
      params.set('cursor', data.next_cursor)
    }

    const res = await fetch(
      `https://api.fal.ai/v1/models?${params.toString()}`,
      {
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
        },
      },
    )

    if (!res.ok) {
      throw new Error(`FAL API error: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as FalApiModelsResponse

    return {
      data: (json.models ?? []).map((m) => ({
        endpoint_id: m.endpoint_id,
        display_name: m.metadata?.display_name ?? m.endpoint_id,
        description: m.metadata?.description ?? '',
        category: m.metadata?.category ?? '',
        tags: m.metadata?.tags ?? [],
        thumbnail_url: m.metadata?.thumbnail_url ?? null,
        status: m.metadata?.status ?? 'active',
        date: m.metadata?.date ?? '',
      })),
      next_cursor: json.next_cursor ?? null,
      has_more: json.has_more ?? false,
    }
  })
