import { describe, expect, it } from 'vitest'
import {
  ALL_IMAGE_MODELS,
  EDIT_MODELS,
  IMAGE_MODELS,
  endpointFor,
  getModelName,
  maxRefsFor,
} from './models'

const KONTEXT_DEV = 'fal-ai/flux-kontext/dev'

/**
 * `ALL_IMAGE_MODELS` used to be a hand-written literal; it is now derived from
 * `IMAGE_MODELS`. This is that literal, verbatim, so the derivation is pinned
 * to it rather than to itself. Delete it with the legacy shape (#190 step 4).
 */
const LEGACY_ALL_IMAGE_MODELS = [
  {
    id: 'fal-ai/flux-kontext/dev',
    name: 'FLUX Kontext Dev',
    description: 'Fast img2img + text steering',
    category: 'FLUX',
    supportsImageInput: true,
    displayPrice: '~$0.03/img',
    useCase: 'Cheap img2img — fast iteration with a reference',
  },
  {
    id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    description: 'Fast, reliable default',
    category: 'FLUX',
    displayPrice: '~$0.003/img',
    useCase: 'Cheapest, fastest — exploration mode, run dozens',
  },
  {
    id: 'fal-ai/flux/dev',
    name: 'FLUX Dev',
    description: 'High-quality 12B model',
    category: 'FLUX',
    displayPrice: '~$0.05/img',
    useCase: 'Quality 12B model — go-to for finished work',
  },
  {
    id: 'fal-ai/kling-image/v3/text-to-image',
    name: 'Kling v3',
    description: 'Latest Kling model',
    category: 'Kling',
    displayPrice: '~$0.05/img',
    useCase: 'Latest Kling — solid all-rounder',
  },
  {
    id: 'fal-ai/kling-image/o3/text-to-image',
    name: 'Kling Omni 3',
    description: 'Flawless consistency',
    category: 'Kling',
    displayPrice: '~$0.05/img',
    useCase: 'Premium Kling — flawless consistency',
  },
  {
    id: 'fal-ai/bytedance/seedream/v4/text-to-image',
    name: 'Seedream v4',
    description: 'ByteDance, high-quality realism',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/bytedance/seedream/v4/edit',
    displayPrice: '~$0.03/img',
    useCase: 'Cheap, high-quality realism — great daily driver',
  },
  {
    id: 'fal-ai/gpt-image-1.5',
    name: 'GPT Image 1.5',
    description: 'OpenAI, high-quality generation',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/gpt-image-1.5/edit',
    displayPrice: '~$0.04/img',
    useCase: 'OpenAI quality — works with references',
  },
  {
    id: 'fal-ai/gpt-image-2',
    name: 'GPT Image 2',
    description: 'OpenAI, quality tiers + inpainting',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/gpt-image-2/edit',
    displayPrice: '~$1.00/img',
    useCase: 'Premium OpenAI — use when you know what you want',
  },
  {
    id: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    name: 'Seedream v4.5',
    description: 'ByteDance, multi-image reference',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/bytedance/seedream/v4.5/edit',
    displayPrice: '~$0.04/img',
    useCase: 'Multi-image reference, premium realism',
  },
  {
    id: 'fal-ai/nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Reasoning-guided generation',
    category: 'Specialized',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/nano-banana-2/edit',
    locked: true,
    displayPrice: '~$0.04/img',
    useCase: 'Reasoning-guided generation',
  },
  {
    id: 'fal-ai/flux-pro/kontext/text-to-image',
    name: 'FLUX Kontext Pro',
    description: 'Pro img2img + text steering',
    category: 'FLUX',
    supportsImageInput: true,
    imageInputModelId: 'fal-ai/flux-pro/kontext',
    displayPrice: '~$0.04/img',
    useCase: 'Pro img2img — solid for refinement work',
  },
  {
    id: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    description: 'SOTA benchmarks, vector art',
    category: 'Specialized',
    displayPrice: '~$0.04/img',
    useCase: 'Vector art and clean illustration',
  },
  {
    id: 'xai/grok-imagine-image',
    name: 'Grok Imagine',
    description: 'xAI, highly aesthetic',
    category: 'Specialized',
    displayPrice: '~$0.04/img',
    useCase: 'xAI — highly aesthetic style',
  },
]

describe('derived legacy shape', () => {
  it('reproduces the hand-written array exactly, order included', () => {
    expect(ALL_IMAGE_MODELS).toEqual(LEGACY_ALL_IMAGE_MODELS)
  })

  it('omits optional keys rather than setting them undefined', () => {
    // `toEqual` treats {a: undefined} as {}, so assert the keys directly:
    // a stray `supportsImageInput: undefined` would spread into every object
    // that gets copied downstream.
    const schnell = ALL_IMAGE_MODELS.find(
      (m) => m.id === 'fal-ai/flux/schnell',
    )!
    expect(Object.keys(schnell).sort()).toEqual([
      'category',
      'description',
      'displayPrice',
      'id',
      'name',
      'useCase',
    ])
  })
})

describe('entries', () => {
  it('gives every model at least one endpoint', () => {
    for (const m of IMAGE_MODELS) {
      expect(m.textToImage ?? m.withImages, m.slug).toBeTruthy()
    }
  })

  it('keeps slugs unique', () => {
    const slugs = IMAGE_MODELS.map((m) => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('only claims extra references if it has an image endpoint', () => {
    // One-directional: both Kontext endpoints take an image but only one, and
    // the source image is already it, so they accept no *extra* references.
    for (const m of IMAGE_MODELS) {
      if (m.maxRefs > 0) expect(m.withImages, m.slug).not.toBeNull()
    }
  })

  it('only borrows a text endpoint when it has none of its own', () => {
    for (const m of IMAGE_MODELS) {
      if (m.textOnlyFallback) expect(m.textToImage, m.slug).toBeNull()
    }
  })
})

describe('endpointFor', () => {
  it('routes to the edit endpoint only when references are attached', () => {
    expect(endpointFor('fal-ai/nano-banana-2', false)).toBe(
      'fal-ai/nano-banana-2',
    )
    expect(endpointFor('fal-ai/nano-banana-2', true)).toBe(
      'fal-ai/nano-banana-2/edit',
    )
  })

  it('leaves a model with no image endpoint on its text endpoint', () => {
    expect(endpointFor('fal-ai/flux/schnell', true)).toBe('fal-ai/flux/schnell')
  })

  it('borrows FLUX Dev when Kontext Dev is asked to run without an image', () => {
    // FAL lists `image_url` as required on fal-ai/flux-kontext/dev, so a
    // text-only submit to it fails outright. This replaces the hand-written
    // KONTEXT_DEV / DRAFT_TEXT_ONLY_FALLBACK special case in use-generator.
    expect(endpointFor(KONTEXT_DEV, false)).toBe('fal-ai/flux/dev')
    expect(endpointFor(KONTEXT_DEV, true)).toBe(KONTEXT_DEV)
  })

  it('passes an unknown id through untouched', () => {
    expect(endpointFor('fal-ai/retired-model', true)).toBe(
      'fal-ai/retired-model',
    )
  })
})

describe('maxRefsFor', () => {
  it('agrees with the EDIT_MODELS numbers it replaces', () => {
    for (const edit of EDIT_MODELS) {
      expect(maxRefsFor(edit.id), edit.id).toBe(edit.maxRefImages)
    }
  })

  it('is 0 for the single-image Kontext endpoints', () => {
    // The source image takes their one slot; they never had an EDIT_MODELS row
    // and so derived 0 before this refactor too.
    expect(maxRefsFor(KONTEXT_DEV)).toBe(0)
    expect(maxRefsFor('fal-ai/flux-pro/kontext/text-to-image')).toBe(0)
  })

  it('is 0 for a model with no image endpoint', () => {
    expect(maxRefsFor('fal-ai/recraft/v3/text-to-image')).toBe(0)
  })

  it('is 0 for an id it does not know', () => {
    expect(maxRefsFor('fal-ai/retired-model')).toBe(0)
  })
})

describe('getModelName', () => {
  it('names both endpoints of a two-endpoint model', () => {
    expect(getModelName('fal-ai/gpt-image-1.5')).toBe('GPT Image 1.5')
    expect(getModelName('fal-ai/gpt-image-1.5/edit')).toBe('GPT Image 1.5')
  })

  it('names the endpoint that used to need a hand-written alias', () => {
    expect(getModelName('fal-ai/flux-pro/kontext')).toBe('FLUX Kontext Pro')
  })

  it('does not let a borrowed endpoint steal its owner name', () => {
    // Kontext Dev falls back to FLUX Dev's endpoint, and a row made that way
    // really was made by FLUX Dev -- it must not be labelled Kontext Dev.
    expect(getModelName('fal-ai/flux/dev')).toBe('FLUX Dev')
  })

  it('names every id EDIT_MODELS used to answer for', () => {
    for (const edit of EDIT_MODELS) {
      expect(getModelName(edit.id), edit.id).toBe(edit.name)
    }
  })

  it('falls back to the raw id, which is what an un-retired model looks like', () => {
    expect(getModelName('fal-ai/retired-model')).toBe('fal-ai/retired-model')
  })
})
