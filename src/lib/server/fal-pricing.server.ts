import { first, sql } from '#/lib/server/db.server'
import { ALL_ENDPOINT_IDS } from '#/features/ai-images/models'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface FalPrice {
  unit_price: number
  unit: string
  currency: string
}

interface PricingApiResponse {
  prices?: Array<{
    endpoint_id: string
    unit_price: number
    unit: string
    currency?: string
  }>
}

async function fetchFromFal(endpointId: string): Promise<FalPrice | null> {
  const res = await fetch(
    `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpointId)}`,
    { headers: { Authorization: `Key ${process.env.FAL_KEY}` } },
  )
  if (!res.ok) return null
  const json = (await res.json()) as PricingApiResponse
  const price = json.prices?.[0]
  if (!price) return null
  return {
    unit_price: price.unit_price,
    unit: price.unit,
    currency: price.currency ?? 'USD',
  }
}

export async function getFalModelPrice(
  endpointId: string,
): Promise<FalPrice | null> {
  // `unit_price` is numeric(10,6), which the driver hands back as a string to
  // avoid float rounding -- hence the `Number()` on every read below.
  interface CacheRow {
    unit_price: string
    unit: string
    currency: string
    fetched_at: Date
  }

  const cached = first(
    await sql<Array<CacheRow>>`
    select unit_price, unit, currency, fetched_at
    from fal_price_cache
    where endpoint_id = ${endpointId}
  `,
  )

  const isStale =
    !cached || Date.now() - cached.fetched_at.getTime() > CACHE_TTL_MS

  if (!isStale) {
    // cached is non-null when !isStale (isStale = !cached || ...)
    const c = cached
    return {
      unit_price: Number(c.unit_price),
      unit: c.unit,
      currency: c.currency,
    }
  }

  const fresh = await fetchFromFal(endpointId)

  if (!fresh) {
    // Return stale cache rather than null if fetch failed
    return cached
      ? {
          unit_price: Number(cached.unit_price),
          unit: cached.unit,
          currency: cached.currency,
        }
      : null
  }

  await sql`
    insert into fal_price_cache (endpoint_id, unit_price, unit, currency, fetched_at)
    values (${endpointId}, ${fresh.unit_price}, ${fresh.unit}, ${fresh.currency}, now())
    on conflict (endpoint_id) do update
    set unit_price = excluded.unit_price,
        unit = excluded.unit,
        currency = excluded.currency,
        fetched_at = excluded.fetched_at
  `

  return fresh
}

export async function warmFalPriceCache(): Promise<void> {
  const allIds = [...ALL_ENDPOINT_IDS]
  await Promise.allSettled(allIds.map((id) => getFalModelPrice(id)))
}
