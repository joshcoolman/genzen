import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFalInput } from './fal-params.server'
import { fetchModelSchema } from './fal-schema.server'
import type { FalModelSchema } from './fal-schema.server'

vi.mock('./fal-schema.server', () => ({ fetchModelSchema: vi.fn() }))

const schema = (over: Partial<FalModelSchema>): FalModelSchema => ({
  sizeParam: null,
  imageSizeAcceptsObject: false,
  safetyToleranceMax: null,
  hasSafetyChecker: false,
  imageInputParam: null,
  ...over,
})

function withSchema(s: Partial<FalModelSchema>) {
  vi.mocked(fetchModelSchema).mockResolvedValue(schema(s))
}

const urls = (n: number) =>
  Array.from({ length: n }, (_, i) => `https://fal/${i}`)

beforeEach(() => vi.clearAllMocks())

/**
 * The submit is the only place a model's limit applies since #341 -- the panel
 * stages whatever you give it. Two things have to hold together: the request
 * carries what the endpoint can hold, and the counts say what happened. A cap
 * that worked while reporting nothing would be the silent truncation this
 * replaced, wearing a return value.
 */
describe('image truncation', () => {
  it('sends what the endpoint holds and reports the rest', async () => {
    withSchema({ imageInputParam: 'image_urls' })
    // Nano Banana 2 holds four; six were staged.
    const built = await buildFalInput({
      modelId: 'fal-ai/nano-banana-2/edit',
      prompt: 'x',
      imageUrls: urls(6),
    })
    expect((built.input.image_urls as Array<string>).length).toBe(4)
    expect(built.imagesRequested).toBe(6)
    expect(built.imagesUsed).toBe(4)
  })

  it('keeps the FIRST images, which is what the note claims', async () => {
    // FAL disagrees with itself about which survive -- Seedream keeps the last
    // ten, FLUX.2 the first four -- so we cut rather than let the endpoint. The
    // set is ordered and index 0 drives the aspect ratio; dropping from the
    // front would change the picture as well as the count.
    withSchema({ imageInputParam: 'image_urls' })
    const built = await buildFalInput({
      modelId: 'fal-ai/bytedance/seedream/v4.5/edit',
      prompt: 'x',
      imageUrls: urls(12),
    })
    expect(built.input.image_urls).toEqual(urls(10))
  })

  it('reports nothing when everything fit', async () => {
    withSchema({ imageInputParam: 'image_urls' })
    const built = await buildFalInput({
      modelId: 'fal-ai/nano-banana-2/edit',
      prompt: 'x',
      imageUrls: urls(2),
    })
    // The row writes the counts only when they disagree, so equal counts are
    // what a normal generation looks like and the card stays quiet.
    expect(built.imagesRequested).toBe(built.imagesUsed)
  })

  it('gives a single-image endpoint one image, not the first of many silently', async () => {
    withSchema({ imageInputParam: 'image_url' })
    const built = await buildFalInput({
      modelId: 'fal-ai/flux-pro/kontext',
      prompt: 'x',
      imageUrls: urls(5),
    })
    expect(built.input.image_url).toBe('https://fal/0')
    expect(built.input.image_urls).toBeUndefined()
    expect(built.imagesUsed).toBe(1)
    expect(built.imagesRequested).toBe(5)
  })

  it('drops every image for a model with no image param, and says so', async () => {
    withSchema({ imageInputParam: null })
    const built = await buildFalInput({
      modelId: 'fal-ai/flux/schnell',
      prompt: 'x',
      imageUrls: urls(3),
    })
    expect(built.input.image_url).toBeUndefined()
    expect(built.input.image_urls).toBeUndefined()
    expect(built.imagesUsed).toBe(0)
    expect(built.imagesRequested).toBe(3)
  })

  it('trusts the schema for an endpoint no entry claims', async () => {
    // The "try any model" case, and the reason the cap is not simply
    // `imageCapacityFor`: an unlisted id has a capacity of 0 there, so reading
    // it straight would throw away every image of a model that takes them.
    withSchema({ imageInputParam: 'image_urls' })
    const built = await buildFalInput({
      modelId: 'fal-ai/some-model-nobody-wrote-down/edit',
      prompt: 'x',
      imageUrls: urls(7),
    })
    expect(built.imagesUsed).toBe(7)
  })
})
