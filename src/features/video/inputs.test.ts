import { describe, expect, it } from 'vitest'
import { VIDEO_MODELS, videoModelBySlug } from './models'
import {
  compatibleModel,
  endpointForImages,
  estimateVideoCost,
  imageCompatibility,
  referenceLabel,
  videoFalInput,
  videoRequestPlan,
} from './inputs'
import type { VideoImageInput, VideoImageRole } from './inputs'

const h3 = videoModelBySlug('minimax-h3')!
const max = videoModelBySlug('minimax-h3-max')!
const kling = videoModelBySlug('kling-o3-pro')!
const flux = videoModelBySlug('flux-3')!
const image = (id: string, role: VideoImageRole): VideoImageInput => ({
  id,
  role,
})
const refs = (n: number) =>
  Array.from({ length: n }, (_, i) => image(String(i), 'reference'))
const settings = {
  prompt: 'A camera follows the subject',
  duration: 8,
  aspectRatio: '16:9',
  resolution: '768P',
  supportsAudio: false,
}

describe('image role compatibility', () => {
  it('distinguishes references from frames and allows mixed input only on its own endpoint', () => {
    const mixed = [image('first', 'first'), ...refs(2), image('last', 'last')]
    expect(imageCompatibility(h3, mixed)).toMatch(/references or frames/)
    expect(imageCompatibility(max, mixed)).toMatch(/reference images/)
    expect(imageCompatibility(kling, mixed)).toBeNull()
    expect(endpointForImages(h3, refs(2)).id).toBe(
      'minimax/h3/reference-to-video',
    )
    expect(endpointForImages(kling, mixed).id).toBe(
      'fal-ai/kling-video/o3/pro/reference-to-video',
    )
  })
  it('enforces individual limits without truncation', () => {
    expect(imageCompatibility(h3, refs(9))).toBeNull()
    expect(imageCompatibility(h3, refs(10))).toMatch(/9 images/)
    expect(imageCompatibility(kling, refs(5))).toMatch(/4 reference/)
    expect(
      imageCompatibility(h3, [image('a', 'first'), image('b', 'first')]),
    ).toMatch(/one first/)
    expect(
      imageCompatibility(max, [image('a', 'last'), image('b', 'last')]),
    ).toMatch(/one last/)
  })
  it('preserves a compatible selection and has no selection for an impossible set', () => {
    expect(compatibleModel(VIDEO_MODELS, h3.slug, refs(2))).toBe(h3)
    expect(compatibleModel(VIDEO_MODELS, max.slug, refs(2))).toBe(h3)
    expect(
      compatibleModel(VIDEO_MODELS, max.slug, [
        image('first', 'first'),
        ...refs(2),
      ]),
    ).toBe(kling)
    expect(compatibleModel(VIDEO_MODELS, max.slug, refs(10))).toBeUndefined()
  })
  it('allows end-only only when documented', () => {
    expect(imageCompatibility(max, [image('a', 'last')])).toBeNull()
    expect(imageCompatibility(h3, [image('a', 'last')])).toMatch(
      /needs a first/,
    )
  })
})

describe('video request contract', () => {
  it('maps interleaved roles to exact endpoint fields, preserving reference order', () => {
    const images = [
      image('refA', 'reference'),
      image('last', 'last'),
      image('first', 'first'),
      image('refB', 'reference'),
    ]
    const endpoint = endpointForImages(kling, images)
    expect(
      videoFalInput(endpoint, images, ['a', 'z', 'start', 'b'], {
        ...settings,
        supportsAudio: true,
      }),
    ).toEqual({
      prompt: settings.prompt,
      duration: '8',
      aspect_ratio: '16:9',
      generate_audio: true,
      start_image_url: 'start',
      end_image_url: 'z',
      image_urls: ['a', 'b'],
    })
    expect(referenceLabel(endpoint, 1)).toBe('@Image2')
  })
  it('uses H3 reference fields and charges the extra refs once per clip', () => {
    const images = refs(7)
    const plan = videoRequestPlan(h3, images, ' Image 1 walks ', 8, '16:9')
    expect(plan.estimatedCostCents).toBe(64)
    expect(estimateVideoCost(h3, 8, undefined, refs(5))).toBe(48)
    const payload = videoFalInput(
      plan.endpoint,
      images,
      images.map((i) => i.id),
      { ...settings, prompt: plan.prompt },
    )
    expect(payload.reference_image_urls).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
    expect(payload).not.toHaveProperty('image_url')
    expect(payload).not.toHaveProperty('image_urls')
    expect(referenceLabel(plan.endpoint, 0)).toBe('Image 1')
  })
  it('keeps an end-only image in the end field and sends required H3 Max defaults', () => {
    const images = [image('end', 'last')]
    const payload = videoFalInput(
      endpointForImages(max, images),
      images,
      ['end-url'],
      settings,
    )
    expect(payload).toMatchObject({
      end_image_url: 'end-url',
      prompt_expansion_mode: 'balanced',
    })
    expect(payload).not.toHaveProperty('image_url')
    expect(payload).not.toHaveProperty('aspect_ratio')
  })
  it('preserves Flux’s separate first-last endpoint and rejects missing uploaded images', () => {
    const images = [image('start', 'first'), image('end', 'last')]
    const endpoint = endpointForImages(flux, images)
    expect(endpoint.id).toBe('blackforestlabs/flux-3/first-last-frame-to-video')
    expect(
      videoFalInput(endpoint, images, ['start-url', 'end-url'], settings),
    ).toMatchObject({ start_image_url: 'start-url', end_image_url: 'end-url' })
    expect(() =>
      videoFalInput(endpoint, images, ['start-url'], settings),
    ).toThrow(/uploaded/)
  })
  it('rejects invalid settings and unsupported roles before request construction', () => {
    expect(() =>
      videoRequestPlan(kling, [], 'x'.repeat(2501), 8, '16:9'),
    ).toThrow(/2500/)
    expect(() => videoRequestPlan(h3, refs(2), 'hello', 20, '16:9')).toThrow(
      /duration/,
    )
    expect(() => videoRequestPlan(h3, refs(2), 'hello', 8, 'auto')).toThrow(
      /aspect ratio/,
    )
    expect(() => videoRequestPlan(max, refs(1), 'hello', 8, '16:9')).toThrow(
      /reference images/,
    )
  })
})

describe('Seedance 2.5 in the shared Video workflow', () => {
  const seedance = videoModelBySlug('seedance-2.5')!

  it('routes text, first/last frames, and references without mixing their contracts', () => {
    const text = videoRequestPlan(
      seedance,
      [],
      'A vehicle drives past',
      30,
      '21:9',
      '1080p',
    )
    expect(text.endpoint.id).toBe('bytedance/seedance-2.5/text-to-video')
    expect(
      videoFalInput(text.endpoint, [], [], {
        ...settings,
        duration: 30,
        resolution: '1080p',
        aspectRatio: '21:9',
        supportsAudio: true,
      }),
    ).toEqual({
      prompt: settings.prompt,
      duration: '30',
      resolution: '1080p',
      aspect_ratio: '21:9',
      generate_audio: true,
    })
    const frames = [image('end', 'last'), image('start', 'first')]
    const framed = videoRequestPlan(
      seedance,
      frames,
      'Drive forward',
      4,
      '16:9',
      '720p',
    )
    expect(framed.endpoint.id).toBe('bytedance/seedance-2.5/image-to-video')
    expect(
      videoFalInput(framed.endpoint, frames, ['end-url', 'start-url'], {
        ...settings,
        duration: 4,
        resolution: '720p',
        supportsAudio: true,
      }),
    ).toEqual({
      prompt: settings.prompt,
      duration: '4',
      resolution: '720p',
      aspect_ratio: 'auto',
      generate_audio: true,
      image_url: 'start-url',
      end_image_url: 'end-url',
    })
    expect(imageCompatibility(seedance, [...frames, ...refs(1)])).toMatch(
      /references or frames/,
    )
    expect(imageCompatibility(seedance, [image('end', 'last')])).toMatch(
      /needs a first/,
    )
  })

  it('preserves nine ordered reference images and their prompt labels', () => {
    const images = refs(9)
    const plan = videoRequestPlan(
      seedance,
      images,
      '@Image1 drives past @Image2',
      10,
      '16:9',
      '720p',
    )
    expect(plan.endpoint.id).toBe('bytedance/seedance-2.5/reference-to-video')
    const payload = videoFalInput(
      plan.endpoint,
      images,
      images.map((i) => `url-${i.id}`),
      {
        ...settings,
        prompt: plan.prompt,
        duration: 10,
        resolution: '720p',
        supportsAudio: true,
      },
    )
    expect(payload).toEqual({
      task: 'reference',
      prompt: plan.prompt,
      duration: '10',
      resolution: '720p',
      aspect_ratio: '16:9',
      generate_audio: true,
      image_urls: images.map((i) => `url-${i.id}`),
    })
    expect(referenceLabel(plan.endpoint, 8)).toBe('@Image9')
    expect(compatibleModel(VIDEO_MODELS, seedance.slug, images)).toBe(seedance)
    expect(imageCompatibility(seedance, refs(10))).toMatch(/9 images/)
  })

  it('quotes the chosen resolution and refuses unsupported settings before submission', () => {
    expect(estimateVideoCost(seedance, 10, '480p', refs(2))).toBe(221)
    expect(estimateVideoCost(seedance, 10, '720p', refs(9))).toBe(473)
    expect(estimateVideoCost(seedance, 10, '1080p', [])).toBe(1164)
    expect(() => videoRequestPlan(seedance, [], 'Drive', 31, '16:9')).toThrow(
      /duration/,
    )
    expect(() =>
      videoRequestPlan(seedance, [], 'Drive', 10, '16:9', '4k'),
    ).toThrow(/resolution/)
  })
})

describe('native audio selection', () => {
  it('sends explicit silence for supporting models and omits the field for others', () => {
    for (const model of VIDEO_MODELS) {
      const payload = videoFalInput(model.endpoints.textToVideo, [], [], {
        ...settings,
        supportsAudio: model.supportsAudio,
        generateAudio: false,
      })
      if (model.supportsAudio)
        expect(payload.generate_audio, model.slug).toBe(false)
      else expect(payload, model.slug).not.toHaveProperty('generate_audio')
    }
  })
  it('prices silent Kling requests lower and keeps Seedance audio price unchanged', () => {
    expect(estimateVideoCost(kling, 10, undefined, refs(2), false)).toBe(112)
    expect(estimateVideoCost(kling, 10, undefined, refs(2), true)).toBe(140)
    const seedance = videoModelBySlug('seedance-2.5')!
    expect(estimateVideoCost(seedance, 10, '720p', refs(2), false)).toBe(473)
    expect(
      videoRequestPlan(kling, [], 'Drive', 10, '16:9', undefined, false)
        .estimatedCostCents,
    ).toBe(112)
  })
})
