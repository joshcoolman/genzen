import { createServerFn } from '@tanstack/react-start'
import type { FalModelPricing } from '../types'

interface FetchPricingInput {
  endpoint_id: string
}

export const fetchPricing = createServerFn({ method: 'GET' })
  .inputValidator((data: FetchPricingInput) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams()
    params.set('endpoint_id', data.endpoint_id)

    const res = await fetch(
      `https://api.fal.ai/v1/models/pricing?${params.toString()}`,
      {
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
        },
      },
    )

    if (!res.ok) {
      throw new Error(`FAL pricing API error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json()

    return json as FalModelPricing
  })
