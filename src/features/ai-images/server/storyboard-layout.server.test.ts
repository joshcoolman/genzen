import { expect, it } from 'vitest'
import { layoutForSchema } from './storyboard-layout.server'
import type { FalModelSchema } from './fal-schema.server'

const schema: FalModelSchema = {
  sizeParam: 'image_size',
  imageSizeAcceptsObject: true,
  imageInputParam: 'image_urls',
  safetyToleranceMax: null,
  hasSafetyChecker: false,
}
it('gives every shot a full-size 16:9 image', () => {
  expect(layoutForSchema(schema)).toMatchObject({
    columns: 1,
    rows: 1,
    emptyCells: 0,
    shotAspectRatio: '16:9',
    sheetAspectRatio: '2048:1152',
    size: { image_size: { width: 2048, height: 1152 } },
  })
})
it('uses the supported 16:9 ratio without a contact sheet or letterboxing', () => {
  expect(
    layoutForSchema({
      ...schema,
      sizeParam: 'aspect_ratio',
      aspectRatioEnumValues: ['1:1', '16:9', '21:9'],
    }),
  ).toMatchObject({ size: { aspect_ratio: '16:9' }, fit: 'fill' })
})
it('honors fixed resolutions before object support, and maps named sizes', () => {
  expect(
    layoutForSchema({
      ...schema,
      imageSizeEnumValues: ['1024x1024', '1536x1024'],
    }).size,
  ).toEqual({ image_size: '1536x1024' })
  expect(
    layoutForSchema({
      ...schema,
      imageSizeAcceptsObject: false,
      imageSizeEnumValues: ['square_hd', 'landscape_16_9'],
    }).size,
  ).toEqual({ image_size: 'landscape_16_9' })
})
it('does not guess dimensions when support cannot be established', () =>
  expect(() =>
    layoutForSchema({
      ...schema,
      sizeParam: null,
      imageSizeAcceptsObject: false,
    }),
  ).toThrow('Cannot verify'))
