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
it('resolves six cinematic panels as a 3×2, 8:3 sheet, not a 16:9 sheet', () => {
  expect(layoutForSchema(6, schema)).toMatchObject({
    columns: 3,
    rows: 2,
    emptyCells: 0,
    shotAspectRatio: '16:9',
    sheetAspectRatio: '2048:768',
    size: { image_size: { width: 2048, height: 768 } },
  })
})
it('resolves four panels separately from six', () =>
  expect(layoutForSchema(4, schema)).toMatchObject({
    columns: 2,
    rows: 2,
    idealSheetRatio: '32:18',
  }))
it('uses supported ratio enums and exposes the necessary letterboxing', () =>
  expect(
    layoutForSchema(6, {
      ...schema,
      sizeParam: 'aspect_ratio',
      aspectRatioEnumValues: ['1:1', '16:9', '21:9'],
    }),
  ).toMatchObject({
    sheetAspectRatio: '21:9',
    size: { aspect_ratio: '21:9' },
    fit: 'letterbox',
  }))
it('honors fixed resolutions before object support, and maps named sizes', () => {
  expect(
    layoutForSchema(6, {
      ...schema,
      imageSizeEnumValues: ['1024x1024', '1536x1024'],
    }).size,
  ).toEqual({ image_size: '1536x1024' })
  expect(
    layoutForSchema(6, {
      ...schema,
      imageSizeAcceptsObject: false,
      imageSizeEnumValues: ['square_hd', 'landscape_16_9'],
    }).size,
  ).toEqual({ image_size: 'landscape_16_9' })
})
it('does not guess dimensions when support cannot be established', () =>
  expect(() =>
    layoutForSchema(6, {
      ...schema,
      sizeParam: null,
      imageSizeAcceptsObject: false,
    }),
  ).toThrow('Cannot verify'))
it.each([2, 3, 4, 5, 6, 7, 8, 9])(
  'keeps %i shots in regular cells with documented unused cells',
  (n) => {
    const layout = layoutForSchema(n, schema)
    expect(layout.columns * layout.rows - layout.emptyCells).toBe(n)
    expect(layout.emptyCells).toBeLessThan(3)
  },
)
