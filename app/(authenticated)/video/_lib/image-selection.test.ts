import { expect, it } from 'vitest'
import { continueImages } from './image-selection'
import type { VideoImageInput } from '#/features/video/inputs'

it('Continue replaces first/last frames and preserves references in their original order', () => {
  const images: Array<VideoImageInput> = [
    { id: 'old-first', role: 'first' },
    { id: 'ref-b', role: 'reference' },
    { id: 'old-last', role: 'last' },
    { id: 'ref-a', role: 'reference' },
  ]
  expect(continueImages(images, { id: 'new-frame' })).toEqual([
    { id: 'new-frame', role: 'first' },
    { id: 'ref-b', role: 'reference' },
    { id: 'ref-a', role: 'reference' },
  ])
  expect(images).toHaveLength(4)
})
it('Continue does not duplicate an extracted frame already held as a reference', () => {
  expect(
    continueImages([{ id: 'frame', role: 'reference' }], { id: 'frame' }),
  ).toEqual([{ id: 'frame', role: 'first' }])
})
