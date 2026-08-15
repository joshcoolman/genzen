import { describe, expect, it } from 'vitest'
import {
  IMAGE_MODELS,
  endpointFor,
  getModelName,
  imageCapacityFor,
  maxRefsFor,
  modelTitleFor,
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
]

/**
 * What `EDIT_MODELS` said before it was deleted: endpoint -> reference cap.
 *
 * Both Seedream entries read 10 here and are 9 now. That is a correction, not
 * drift: FAL takes ten images total and `maxRefs` counts them beyond the first,
 * so 10 claimed an eleventh slot FAL would have filled by silently dropping the
 * first image. The old number is left in the fixture with the offset spelled
 * out, because a fixture quietly edited to match the code pins nothing.
 */
const LEGACY_EDIT_CAPS: Record<string, number> = {
  'fal-ai/gpt-image-1.5/edit': 4,
  'fal-ai/gpt-image-2/edit': 4,
  'fal-ai/nano-banana-2/edit': 3,
  'fal-ai/bytedance/seedream/v4/edit': 10,
  'fal-ai/bytedance/seedream/v4.5/edit': 10,
}

/** Endpoints whose legacy cap was one too high. Value is the corrected cap. */
const CORRECTED_EDIT_CAPS: Record<string, number> = {
  'fal-ai/bytedance/seedream/v4/edit': 9,
  'fal-ai/bytedance/seedream/v4.5/edit': 9,
}

describe('lineup, pinned to what shipped', () => {
  it('keeps the same models in the same order', () => {
    // A subset check, not equality: the lineup grows (#262 added a cheap tier).
    // What is pinned is that the models that shipped are still there, still in
    // that relative order -- a new entry may be appended or slotted between
    // them, but none of them may be reordered or silently dropped.
    const legacyIds = LEGACY_ALL_IMAGE_MODELS.map((m) => m.id)
    const live = IMAGE_MODELS.map(pickerId)
    expect(live.filter((id) => legacyIds.includes(id))).toEqual(legacyIds)
    for (const legacy of LEGACY_ALL_IMAGE_MODELS) {
      expect(IMAGE_MODELS.find((m) => pickerId(m) === legacy.id)?.name).toBe(
        legacy.name,
      )
    }
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
      expect(m.description, legacy.id).toBe(legacy.description)
      // The fixture keeps the string the lineup used to carry; `price` is the
      // number it became in #341. Pinned by parsing the old string rather than
      // by rewriting the fixture, so the number still has to mean what the
      // label said.
      expect(m.price, legacy.id).toBe(
        Number(/[\d.]+/.exec(legacy.displayPrice)![0]),
      )
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

  it('gives every borrowed endpoint a name', () => {
    // A borrow points at an endpoint no entry owns, so nothing else guarantees
    // it resolves. Cutting FLUX Dev from the lineup without leaving its name
    // behind would relabel every Kontext-Dev-without-an-image row a raw id.
    for (const m of IMAGE_MODELS) {
      if (!m.textOnlyFallback) continue
      expect(getModelName(m.textOnlyFallback), m.slug).not.toBe(
        m.textOnlyFallback,
      )
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
      expect(maxRefsFor(id), id).toBe(CORRECTED_EDIT_CAPS[id] ?? cap)
    }
  })

  it('holds ten images for Seedream, not eleven', () => {
    // The correction, stated as the number that is actually wrong when it is
    // wrong: FAL takes ten and keeps the LAST ten, so an eleventh slot loses
    // image one -- the one an effect reads orientation from.
    expect(imageCapacityFor('fal-ai/bytedance/seedream/v4/edit')).toBe(10)
    expect(imageCapacityFor('fal-ai/bytedance/seedream/v4.5/edit')).toBe(10)
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

/**
 * The number the panel shows and caps on (#297). `maxRefs` counts images
 * *beyond the source*, and the panel showed it as the total -- so every model
 * read one lower than the endpoint can actually take. There is no source any
 * more, so the two numbers had to stop being the same number.
 */
describe('imageCapacityFor', () => {
  it('is one more than maxRefs, because the source was always in the count', () => {
    // The case that made the off-by-one visible: the panel read `0/3` for an
    // endpoint that takes four images.
    expect(imageCapacityFor('fal-ai/nano-banana-2')).toBe(4)
    expect(maxRefsFor('fal-ai/nano-banana-2')).toBe(3)
  })

  it('is 1 for the single-image Kontext endpoints, not 0', () => {
    // They take exactly one image. Under the old reading that was "0 refs plus
    // the source"; under one set it is a capacity of one, and a strip that
    // offers a slot rather than refusing every image.
    expect(imageCapacityFor(KONTEXT_DEV)).toBe(1)
    expect(imageCapacityFor('fal-ai/flux-pro/kontext/text-to-image')).toBe(1)
  })

  it('is 0 when the model has no image endpoint at all', () => {
    expect(imageCapacityFor('fal-ai/recraft/v3/text-to-image')).toBe(0)
    expect(imageCapacityFor('fal-ai/retired-model')).toBe(0)
  })

  it('resolves either endpoint of a two-endpoint model to the same capacity', () => {
    // Canvas selects by the edit endpoint and Images by the text one; a cap
    // that disagreed between them would truncate on exactly one surface.
    expect(imageCapacityFor('fal-ai/gpt-image-1.5')).toBe(
      imageCapacityFor('fal-ai/gpt-image-1.5/edit'),
    )
  })

  it('minimum across a mixed selection is the small model, not the first', () => {
    // The silent-truncation bug the panel had: Nano Banana 2 and FLUX Kontext
    // Pro ticked together offered four slots, and FLUX -- whose schema takes
    // `image_url`, not `image_urls` -- received the first image alone.
    const selection = ['fal-ai/nano-banana-2', 'fal-ai/flux-pro/kontext']
    expect(Math.min(...selection.map(imageCapacityFor))).toBe(1)
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

/**
 * The optimistic card draws a badge before anything has been asked of the
 * server, and the reserve and the completion write the row's title. All three
 * call `modelTitleFor`; if they could disagree, the badge would rename itself
 * at settle -- which is the whole defect #367 closed.
 */
describe('modelTitleFor', () => {
  it('gives the same name for both of a model endpoints', () => {
    for (const m of IMAGE_MODELS) {
      for (const hasImages of [false, true]) {
        const endpoint = endpointFor(pickerId(m), hasImages)
        // What the browser guesses at click time is what the server resolves
        // and writes. A borrowed text-only endpoint is the deliberate
        // exception -- the row really was made by the model it borrowed from.
        if (m.textOnlyFallback && endpoint === m.textOnlyFallback) continue
        expect(modelTitleFor(endpoint), `${m.slug}/${hasImages}`).toBe(m.name)
      }
    }
  })

  it('reads an /edit route as the model, not as a model of its own', () => {
    expect(modelTitleFor('fal-ai/bytedance/seedream/v4/edit')).toBe(
      modelTitleFor('fal-ai/bytedance/seedream/v4'),
    )
  })

  it('falls back to the raw id rather than rendering an empty badge', () => {
    expect(modelTitleFor('fal-ai/unknown-thing')).toBe('fal-ai/unknown-thing')
  })
})
