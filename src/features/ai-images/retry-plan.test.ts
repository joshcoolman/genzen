import { describe, expect, it } from 'vitest'
import { RetryNotReproducible, planHasImages, planRetry } from './retry-plan'

const base = { prompt: 'a cat', model: 'nano-banana-2' }

describe('planRetry', () => {
  it('prefers a library source, the common path since #205', () => {
    const plan = planRetry({ ...base, source_image_id: 'img-1' })
    expect(plan.source).toEqual({ kind: 'library', imageId: 'img-1' })
  })

  it('carries a URL source through as a URL to fetch, not to hand to FAL', () => {
    const plan = planRetry({ ...base, source_image_url: 'https://x/y.png' })
    expect(plan.source).toEqual({ kind: 'url', url: 'https://x/y.png' })
  })

  // #367 swapped what `prompt` means: it is now what the user typed, and the
  // string FAL received moved to `sent_prompt`. Replaying the wrong one is
  // silent -- the retry succeeds and generates something else under a caption
  // that still looks right -- so both eras are pinned here.
  it('replays the sent string, not the caption, when the two differ', () => {
    const plan = planRetry({
      ...base,
      prompt: 'a cat',
      sent_prompt: 'Shoot on 35mm. a cat',
    })
    expect(plan.prompt).toBe('Shoot on 35mm. a cat')
  })

  it('replays `prompt` on a row written before the split, where it was the sent string', () => {
    const plan = planRetry({ ...base, prompt: 'Shoot on 35mm. a cat' })
    expect(plan.prompt).toBe('Shoot on 35mm. a cat')
  })

  it('keeps reference ids in order', () => {
    const plan = planRetry({ ...base, reference_image_ids: ['c', 'a', 'b'] })
    expect(plan.referenceImageIds).toEqual(['c', 'a', 'b'])
  })

  it('refuses a pasted source rather than silently dropping it', () => {
    expect(() =>
      planRetry({ ...base, source_image_sha256: 'deadbeef' }),
    ).toThrow(RetryNotReproducible)
  })

  it('still retries when a sha is present alongside a real id', () => {
    // #210 records the hash for provenance; an id means the bytes are reachable.
    const plan = planRetry({
      ...base,
      source_image_sha256: 'deadbeef',
      source_image_id: 'img-1',
    })
    expect(plan.source).toEqual({ kind: 'library', imageId: 'img-1' })
  })

  it('refuses a row with no prompt or no model', () => {
    expect(() => planRetry({ model: 'm' })).toThrow(RetryNotReproducible)
    expect(() => planRetry({ prompt: 'p' })).toThrow(RetryNotReproducible)
  })
})

describe('planHasImages', () => {
  it('is true for a source alone, references alone, or both', () => {
    expect(planHasImages(planRetry({ ...base, source_image_id: 'i' }))).toBe(
      true,
    )
    expect(
      planHasImages(planRetry({ ...base, reference_image_ids: ['r'] })),
    ).toBe(true)
  })

  it('is false for text-only', () => {
    expect(planHasImages(planRetry(base))).toBe(false)
  })
})
