import { fetchModelSchema } from './fal-schema.server'
import type { FalModelSchema } from './fal-schema.server'
import type { StoryboardLayout } from '../skills/types'

const NAMED_SIZES: Record<string, string> = {
  square: '1:1',
  square_hd: '1:1',
  portrait_4_3: '3:4',
  portrait_16_9: '9:16',
  landscape_4_3: '4:3',
  landscape_16_9: '16:9',
}
const ratioValue = (ratio: string) => {
  const [a, b] = ratio.split(':').map(Number)
  return a / b
}

/** A regular grid with at most two unused cells, rather than tiny strips for prime counts. */
export function storyboardGrid(count: number) {
  const columns = count <= 3 ? 1 : count <= 5 ? 2 : 3
  return { columns, rows: Math.ceil(count / columns) }
}

export function layoutForSchema(
  count: number,
  schema: FalModelSchema,
): StoryboardLayout {
  if (!Number.isInteger(count) || count < 2 || count > 9)
    throw new Error('Storyboard supports 2–9 shots.')
  const { columns, rows } = storyboardGrid(count)
  const idealSheetRatio = `${16 * columns}:${9 * rows}`
  const target = ratioValue(idealSheetRatio)
  const common = {
    columns,
    rows,
    emptyCells: columns * rows - count,
    readingOrder: 'left-to-right, top-to-bottom' as const,
    shotAspectRatio: '16:9' as const,
    idealSheetRatio,
    fit: 'letterbox' as const,
  }
  if (
    schema.sizeParam === 'image_size' &&
    schema.imageSizeAcceptsObject &&
    !schema.imageSizeEnumValues?.some((v) => /^\d+x\d+$/.test(v))
  ) {
    const width = Math.round((target >= 1 ? 2048 : 2048 * target) / 32) * 32
    const height = Math.round((target >= 1 ? 2048 / target : 2048) / 32) * 32
    return {
      ...common,
      fit: 'fill',
      sheetAspectRatio: `${width}:${height}`,
      size: { image_size: { width, height } },
    }
  }
  const candidates =
    schema.sizeParam === 'aspect_ratio'
      ? schema.aspectRatioEnumValues
          ?.filter((v) => /^\d+:\d+$/.test(v))
          .map((v) => ({ value: v, ratio: v }))
      : schema.imageSizeEnumValues?.flatMap((v) =>
          /^\d+x\d+$/.test(v)
            ? [{ value: v, ratio: v.replace('x', ':') }]
            : NAMED_SIZES[v]
              ? [{ value: v, ratio: NAMED_SIZES[v] }]
              : [],
        )
  if (!candidates?.length)
    throw new Error(
      'Cannot verify storyboard dimensions for this model. Choose another model or try again.',
    )
  const chosen = candidates.reduce((best, item) =>
    Math.abs(Math.log(ratioValue(item.ratio) / target)) <
    Math.abs(Math.log(ratioValue(best.ratio) / target))
      ? item
      : best,
  )
  return {
    ...common,
    sheetAspectRatio: chosen.ratio,
    size:
      schema.sizeParam === 'aspect_ratio'
        ? { aspect_ratio: chosen.value }
        : { image_size: chosen.value },
  }
}

export async function resolveStoryboardLayout(model: string, count: number) {
  return layoutForSchema(count, await fetchModelSchema(model, { strict: true }))
}
