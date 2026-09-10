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
