import { getFalModelPrice } from './fal-pricing.server'
import { RATIO_TO_SIZE } from '#/features/ai-images/constants'

interface FalCostParams {
  quantity?: number
  aspectRatio?: string
  widthPx?: number
  heightPx?: number
  durationSeconds?: number
}

export async function computeFalCostCents(
  endpointId: string,
  params: FalCostParams,
): Promise<number | null> {
  const price = await getFalModelPrice(endpointId)
  if (!price) return null

  const { unit_price, unit } = price
  const quantity = params.quantity ?? 1

  if (unit === 'images' || unit === 'units') {
    return cents(unit_price * quantity)
  }

  if (unit === 'megapixels' || unit === 'processed megapixels') {
    let width = params.widthPx
    let height = params.heightPx

    if ((!width || !height) && params.aspectRatio) {
      const sizeMap = RATIO_TO_SIZE as Record<
        string,
        { width: number; height: number } | undefined
      >
      const size = sizeMap[params.aspectRatio]
      if (size) {
        width = size.width
        height = size.height
      }
    }

    // Default to 1024×1024 if dimensions unknown
    width = width ?? 1024
    height = height ?? 1024

    const megapixels = (width * height) / 1_000_000
    return cents(unit_price * megapixels * quantity)
  }

  if (unit === 'seconds') {
    if (params.durationSeconds == null) return null
    return cents(unit_price * params.durationSeconds * quantity)
  }

  // **`compute seconds` is deliberately absent, and no longer priced anywhere.**
  //
  // #410 priced it at completion from the result's own `timings.inference`,
  // against FAL's pricing API. Measuring genzen's recorded costs against FAL's
  // actual billing showed why that was wrong: the pricing API reports
  // `0.00017 / compute seconds` for LTX-2.5 and for Grok alike, and LTX is
  // demonstrably billed at $0.01 per unit -- so that figure is a **placeholder
  // returned when FAL has no real price for an endpoint**, not a rate.
  //
  // FLUX.2 Flash was the only model the mechanism actually priced, and FAL
  // bills it per megapixel, not per compute second. The result was a figure
  // 4.5x under what was charged. There is no endpoint for which
  // `compute seconds` is the real unit, so there is nothing left to price this
  // way; the lineup's per-image figure is both closer and honest about being an
  // estimate.
  return null
}

/**
 * Cents, to two decimal places of a cent.
 *
 * **Not `Math.round`**, which was here until the measurement above. A z-image
 * generation costs 0.52c and recorded 1c -- a 2x over-report on the cheapest
 * tier, in an app whose promise is that its figures match FAL's. The column is
 * JSONB with no integer constraint and `formatCents` already renders four
 * decimals, so nothing downstream wanted the rounding.
 */
function cents(dollars: number): number {
  return Math.round(dollars * 100 * 100) / 100
}
