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
    return Math.round(unit_price * quantity * 100)
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
    return Math.round(unit_price * megapixels * quantity * 100)
  }

  if (unit === 'seconds') {
    if (params.durationSeconds == null) return null
    return Math.round(unit_price * params.durationSeconds * quantity * 100)
  }

  // `compute seconds` is deliberately absent here: nothing at submit time knows
  // how long the GPU will run. It is priced at completion instead, from the
  // result's own timings -- see `computeFalCostFromTimings` below.
  return null
}

/**
 * What a `compute seconds` model actually cost, from the completed result.
 *
 * The only unit that cannot be priced at submit, and the reason two live models
 * -- FLUX.2 Flash and Grok Imagine 2.0 -- recorded no cost at all until #400:
 * `computeFalCostCents` returned null for them and nothing else ever asked.
 *
 * This is measured seconds at FAL's own published rate, which is the closest to
 * a real figure genzen can get without an Admin key and the usage API (#400).
 * It is still arithmetic, so the caller leaves `provider_cost_is_estimate` true.
 *
 * Returns null for any other unit. A model billed per image or per megapixel
 * was already priced correctly at submit, and re-deriving the same number here
 * would be a second pricing lookup for no new information.
 */
export async function computeFalCostFromTimings(
  endpointId: string,
  falResultData: Record<string, unknown> | null | undefined,
): Promise<number | null> {
  const seconds = inferenceSeconds(falResultData)
  if (seconds == null) return null

  const price = await getFalModelPrice(endpointId)
  if (!price || price.unit !== 'compute seconds') return null

  // **Not rounded to a whole cent**, unlike every branch above. A measured
  // FLUX.2 Flash run is 0.47s, which is $0.00037 -- `Math.round` turns the one
  // figure this function exists to produce into 0, which is a second silent
  // wrongness dressed up as a fix. Two decimal places of a cent is exactly the
  // precision the readers already render (`formatCents` prints four decimal
  // places of a dollar below a cent), and the value is JSONB, so nothing in the
  // schema ever wanted an integer.
  return Math.round(price.unit_price * seconds * 100 * 100) / 100
}

/**
 * The GPU time a result reports, in seconds.
 *
 * FAL's image queue returns `timings: { inference, safety_checker? }`, which
 * genzen already persists on every completed row. `safety_checker` is left out
 * on purpose: it is a fraction of a second and it is not obvious FAL bills for
 * it, so counting it would be inventing a charge.
 *
 * Not every endpoint sends timings -- Grok returns none -- and one that does not
 * still records no cost. That is the honest outcome: absent beats a number
 * nothing measured.
 */
function inferenceSeconds(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data || typeof data !== 'object') return null
  const timings = (data as { timings?: Record<string, unknown> }).timings
  if (!timings || typeof timings !== 'object') return null
  const inference = timings.inference
  if (typeof inference !== 'number' || !Number.isFinite(inference)) return null
  if (inference <= 0) return null
  return inference
}
