import { describe, expect, it, vi } from 'vitest'

// The aggregation itself is SQL and cannot be meaningfully mocked -- mocking
// `sql` would test the mock. It was verified against the real database instead,
// and what is unit-tested here is the fold, which is where the logic lives.
vi.mock('./db.server', () => ({ sql: vi.fn() }))

const { foldModels } = await import('./account-stats.server')

describe('foldModels', () => {
  it("merges a model's endpoints into one row", () => {
    // Real ids off the local database. Nano Banana's picker id and its /edit
    // endpoint are two rows for one model; ranking them apart would split a
    // daily driver in half and rank neither honestly.
    const folded = foldModels([
      {
        model_id: 'fal-ai/nano-banana-2/edit',
        model_label: null,
        count: 12,
        spend_cents: 96,
      },
      {
        model_id: 'fal-ai/nano-banana-2',
        model_label: null,
        count: 3,
        spend_cents: 24,
      },
    ])

    expect(folded).toEqual([
      { name: 'Nano Banana 2', count: 15, spendCents: 120 },
    ])
  })

  it('names a video row from its label, not the image lineup', () => {
    // A video endpoint is in no image model's index, so `modelTitleFor` would
    // hand back the raw id. The submit writes `model_label` for exactly this.
    const folded = foldModels([
      {
        model_id: 'lightricks/ltx-2.5/image-to-video/fast',
        model_label: 'LTX-2.5 Fast',
        count: 5,
        spend_cents: 360,
      },
      {
        model_id: 'lightricks/ltx-2.5/text-to-video/fast',
        model_label: 'LTX-2.5 Fast',
        count: 1,
        spend_cents: 90,
      },
    ])

    expect(folded).toEqual([
      { name: 'LTX-2.5 Fast', count: 6, spendCents: 450 },
    ])
  })

  it('ranks by use, then by spend', () => {
    const folded = foldModels([
      {
        model_id: 'fal-ai/z-image/turbo',
        model_label: null,
        count: 2,
        spend_cents: 1,
      },
      {
        model_id: 'fal-ai/flux-pro/kontext',
        model_label: null,
        count: 5,
        spend_cents: 20,
      },
      // Same count as z-image; the dearer one goes first, so a tie does not
      // order on Map insertion.
      {
        model_id: 'fal-ai/bytedance/seedream/v4/text-to-image',
        model_label: null,
        count: 2,
        spend_cents: 6,
      },
    ])

    // FLUX Kontext Pro left the lineup in #304 and still resolves, via
    // `RETIRED_MODEL_NAMES` -- which is the point: images outlive the models
    // that made them, and a retired row must not degrade to a raw endpoint id.
    expect(folded.map((m) => m.name)).toEqual([
      'FLUX Kontext Pro',
      'Seedream v4',
      'Z-Image Turbo',
    ])
  })

  it('drops a row that names no model at all', () => {
    // Rows written before `fal_model_id` existed. A blank name in a ranked list
    // is worse than a missing row.
    expect(
      foldModels([
        { model_id: null, model_label: null, count: 9, spend_cents: 30 },
      ]),
    ).toEqual([])
  })

  it('keeps fractional cents when folding', () => {
    // The compute-seconds models record a fraction of a cent (#400). Summing
    // them must not land on an integer boundary by accident.
    const folded = foldModels([
      {
        model_id: 'fal-ai/flux-2/flash',
        model_label: null,
        count: 1,
        spend_cents: 0.04,
      },
      {
        model_id: 'fal-ai/flux-2/flash/edit',
        model_label: null,
        count: 1,
        spend_cents: 0.98,
      },
    ])

    expect(folded).toEqual([
      { name: 'FLUX.2 Flash', count: 2, spendCents: 1.02 },
    ])
  })
})
