import { describe, expect, it } from 'vitest'
import {
  IMAGE_MODELS,
  endpointFor,
  getModelName,
  maxRefsFor,
  pickerId,
} from './models'

const KONTEXT_DEV = 'fal-ai/flux-kontext/dev'

/**
 * The hand-written array `models.ts` carried before #190, verbatim. The lineup
 * is pinned to it rather than to itself, so a rewrite of the file cannot
 * quietly change which model answers to which endpoint. Entries removed from
 * the lineup on purpose are deleted from here in the same commit.
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

/** What `EDIT_MODELS` said before it was deleted: endpoint -> reference cap. */
const LEGACY_EDIT_CAPS: Record<string, number> = {
  'fal-ai/gpt-image-1.5/edit': 4,
  'fal-ai/gpt-image-2/edit': 4,
  'fal-ai/nano-banana-2/edit': 3,
  'fal-ai/bytedance/seedream/v4/edit': 10,
  'fal-ai/bytedance/seedream/v4.5/edit': 10,
}

describe('lineup, pinned to what shipped', () => {
  it('keeps the same models in the same order', () => {
    expect(IMAGE_MODELS.map(pickerId)).toEqual(
      LEGACY_ALL_IMAGE_MODELS.map((m) => m.id),
    )
    expect(IMAGE_MODELS.map((m) => m.name)).toEqual(
      LEGACY_ALL_IMAGE_MODELS.map((m) => m.name),
    )
  })

  it('routes each model to the endpoint it used to route to', () => {
    for (const legacy of LEGACY_ALL_IMAGE_MODELS) {
      const m = IMAGE_MODELS.find((x) => pickerId(x) === legacy.id)!
      expect(m, legacy.id).toBeDefined()
      // `imageInputModelId` was set only when a model had a *different*
      // endpoint to switch to, which is why Kontext Dev never had one.
      const switchesTo = m.textToImage ? m.withImages : undefined
      expect(switchesTo ?? undefined, legacy.id).toBe(legacy.imageInputModelId)
      expect(m.withImages !== null, legacy.id).toBe(
        legacy.supportsImageInput === true,
      )
      expect(m.locked === true, legacy.id).toBe(legacy.locked === true)
      expect(m.description, legacy.id).toBe(legacy.description)
      expect(m.displayPrice, legacy.id).toBe(legacy.displayPrice)
    }
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
    for (const [id, cap] of Object.entries(LEGACY_EDIT_CAPS)) {
      expect(maxRefsFor(id), id).toBe(cap)
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
    for (const id of Object.keys(LEGACY_EDIT_CAPS)) {
      expect(getModelName(id), id).not.toBe(id)
    }
  })

  it('names a retired endpoint that no live model claims', () => {
    expect(getModelName('fal-ai/bytedance/seedream/v4')).toBe('Seedream v4')
  })

  it('falls back to the raw id, which is what an un-retired model looks like', () => {
    expect(getModelName('fal-ai/retired-model')).toBe('fal-ai/retired-model')
  })
})
