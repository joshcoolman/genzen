import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import { ALL_IMAGE_MODELS, EDIT_MODELS } from '@/features/ai-images/models'

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
  const supabase = getSupabaseAdmin()

  interface CacheRow {
    unit_price: number
    unit: string
    currency: string
    fetched_at: string
  }

  const { data: cached } = (await supabase
    .from('fal_price_cache')
    .select('unit_price, unit, currency, fetched_at')
    .eq('endpoint_id', endpointId)
    .single()) as { data: CacheRow | null }

  const isStale =
    !cached || Date.now() - new Date(cached.fetched_at).getTime() > CACHE_TTL_MS

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

  await supabase.from('fal_price_cache').upsert({
    endpoint_id: endpointId,
    unit_price: fresh.unit_price,
    unit: fresh.unit,
    currency: fresh.currency,
    fetched_at: new Date().toISOString(),
  })

  return fresh
}

export async function warmFalPriceCache(): Promise<void> {
  const allIds = [
    ...ALL_IMAGE_MODELS.map((m) => m.id),
    ...EDIT_MODELS.map((m) => m.id),
  ]
  await Promise.allSettled(allIds.map((id) => getFalModelPrice(id)))
}
