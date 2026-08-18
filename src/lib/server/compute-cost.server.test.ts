import { beforeEach, describe, expect, it, vi } from 'vitest'

// `compute-cost.server` reaches the pricing cache, which reaches Postgres. The
// arithmetic is the part worth testing, so the price is stubbed and the DB never
// opens -- same reason `fal-params.server.test.ts` stubs the schema fetch.
const getFalModelPrice = vi.fn()
vi.mock('./fal-pricing.server', () => ({
  getFalModelPrice: (id: string) => getFalModelPrice(id),
}))

const { computeFalCostCents, computeFalCostFromTimings } =
  await import('./compute-cost.server')

beforeEach(() => {
  getFalModelPrice.mockReset()
})

const price = (unit: string, unit_price: number) => {
  getFalModelPrice.mockResolvedValue({ unit_price, unit, currency: 'USD' })
}

describe('computeFalCostCents', () => {
  it('returns nothing for a compute-seconds model, because submit cannot know', () => {
    // The #400 defect: FLUX.2 Flash and Grok fell through every branch and the
    // row recorded no cost at all. Null is now the *intended* answer here --
    // the figure exists only once the result does.
    price('compute seconds', 0.0008)
    return expect(
      computeFalCostCents('fal-ai/flux-2/flash', { aspectRatio: '1:1' }),
    ).resolves.toBeNull()
  })
})

describe('computeFalCostFromTimings', () => {
  it('prices a compute-seconds model from its measured inference time', async () => {
    price('compute seconds', 0.0008)
    // A real FLUX.2 Flash edit off the local database: 12.24s at $0.0008/s is
    // $0.0098, so 0.98 cents.
    await expect(
      computeFalCostFromTimings('fal-ai/flux-2/flash/edit', {
        timings: { inference: 12.240180184002384 },
      }),
    ).resolves.toBe(0.98)
  })

  it('keeps a sub-cent run instead of rounding it to nothing', async () => {
    price('compute seconds', 0.0008)
    // A measured text-to-image run: 0.468s is $0.00037. Rounding to a whole
    // cent stores 0, which reads as free and sums to nothing -- the same silent
    // absence #400 is about, one layer down.
    await expect(
      computeFalCostFromTimings('fal-ai/flux-2/flash', {
        timings: { inference: 0.46789862400328275 },
      }),
    ).resolves.toBe(0.04)
  })

  it('ignores safety_checker time, which is not obviously billed', async () => {
    price('compute seconds', 1)
    await expect(
      computeFalCostFromTimings('x', {
        timings: { inference: 2, safety_checker: 5 },
      }),
    ).resolves.toBe(200)
  })

  it('returns nothing for a model billed by any other unit', async () => {
    // Already priced correctly at submit. Re-deriving it here would be a second
    // pricing lookup that cannot produce a new fact.
    price('images', 0.08)
    await expect(
      computeFalCostFromTimings('fal-ai/nano-banana-2', {
        timings: { inference: 4 },
      }),
    ).resolves.toBeNull()
  })

  it('returns nothing when the result carries no timings', async () => {
    // Grok is this case: compute-seconds billing and no timings in the payload,
    // so there is nothing to measure. Absent beats an invented number.
    price('compute seconds', 0.00017)
    await expect(
      computeFalCostFromTimings('xai/grok-imagine-image/v2.0/edit', {
        images: [{ url: 'https://example.test/a.png' }],
      }),
    ).resolves.toBeNull()
    // Cheap enough to assert: no timings means the price is never even fetched.
    expect(getFalModelPrice).not.toHaveBeenCalled()
  })

  it('survives a missing price and a junk payload', async () => {
    getFalModelPrice.mockResolvedValue(null)
    await expect(
      computeFalCostFromTimings('x', { timings: { inference: 3 } }),
    ).resolves.toBeNull()
    await expect(computeFalCostFromTimings('x', null)).resolves.toBeNull()
    await expect(
      computeFalCostFromTimings('x', { timings: { inference: 0 } }),
    ).resolves.toBeNull()
  })
})
