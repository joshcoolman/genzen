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

  return null
}
