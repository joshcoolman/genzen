import { beforeEach, describe, expect, it, vi } from 'vitest'

// `compute-cost.server` reaches the pricing cache, which reaches Postgres. The
// arithmetic is the part worth testing, so the price is stubbed and the DB never
// opens -- same reason `fal-params.server.test.ts` stubs the schema fetch.
const getFalModelPrice = vi.fn()
vi.mock('./fal-pricing.server', () => ({
  getFalModelPrice: (id: string) => getFalModelPrice(id),
}))

const { computeFalCostCents } = await import('./compute-cost.server')

beforeEach(() => {
  getFalModelPrice.mockReset()
})

const price = (unit: string, unit_price: number) => {
  getFalModelPrice.mockResolvedValue({ unit_price, unit, currency: 'USD' })
}

describe('computeFalCostCents', () => {
  /**
   * The rounding cases are the point of this file.
   *
   * `Math.round` to a whole cent was here until genzen's recorded costs were
   * measured against FAL's actual invoices: a z-image generation costs 0.52c
   * and recorded 1c, a 2x over-report on the cheapest tier.
   */
  it('keeps a sub-cent megapixel figure instead of rounding it to a whole cent', async () => {
    price('megapixels', 0.005)
    // 1024x1024 is 1.048 MP at half a cent a megapixel: 0.524c, not 1c.
    await expect(
      computeFalCostCents('fal-ai/z-image/turbo', { aspectRatio: '1:1' }),
    ).resolves.toBeCloseTo(0.52, 2)
  })

  it('prices per image without inventing precision', async () => {
    price('images', 0.08)
    await expect(
      computeFalCostCents('fal-ai/nano-banana-2', { quantity: 1 }),
    ).resolves.toBe(8)
  })

  it('prices a clip by its duration', async () => {
    price('seconds', 0.085)
    await expect(
      computeFalCostCents('blackforestlabs/flux-3/image-to-video', {
        durationSeconds: 8,
      }),
    ).resolves.toBeCloseTo(68, 2)
  })

  it('returns null for a clip with no duration rather than guessing one', async () => {
    price('seconds', 0.085)
    await expect(
      computeFalCostCents('blackforestlabs/flux-3/image-to-video', {}),
    ).resolves.toBeNull()
  })

  /**
   * `compute seconds` is priced nowhere, on purpose.
   *
   * #410 priced it at completion from the result's own timings. Measuring
   * against FAL's billing killed that: the pricing API reports
   * `0.00017 / compute seconds` for both Grok and LTX-2.5, and LTX is billed at
   * $0.01 per unit -- so the figure is a placeholder for "no price known", not a
   * rate. FLUX.2 Flash, the only model the mechanism actually priced, is billed
   * per megapixel and came out 4.5x under.
   */
  it('returns null for a compute-seconds price rather than trusting it', async () => {
    price('compute seconds', 0.0008)
    await expect(
      computeFalCostCents('fal-ai/flux-2/flash', { aspectRatio: '1:1' }),
    ).resolves.toBeNull()
  })

  it('returns null when the endpoint has no price at all', async () => {
    getFalModelPrice.mockResolvedValue(null)
    await expect(
      computeFalCostCents('something/unknown', { quantity: 1 }),
    ).resolves.toBeNull()
  })
})
