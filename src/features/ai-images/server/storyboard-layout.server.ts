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

/**
 * Resolve one full-size canvas per shot, at the ratio the plan chose.
 *
 * The plan's ratio is a request, not a guarantee: a renderer offers a fixed
 * menu of sizes, so this snaps to the nearest one it actually accepts and
 * `sheetAspectRatio` reports what will really be sent. That was already true
 * of 16:9 -- widening the request from one hard-coded ratio to whatever the
 * brief called for (#714) does not change the snapping, only what it aims at.
 *
 * Legacy sheets keep their saved settings.
 */
export function layoutForSchema(
  schema: FalModelSchema,
  shotAspectRatio: string = '16:9',
): StoryboardLayout {
  const target = ratioValue(shotAspectRatio)
  const common = {
    columns: 1,
    rows: 1,
    emptyCells: 0,
    readingOrder: 'left-to-right, top-to-bottom' as const,
    shotAspectRatio,
    idealSheetRatio: shotAspectRatio,
    fit: 'fill' as const,
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

export async function resolveStoryboardLayout(
  model: string,
  shotAspectRatio?: string,
) {
  return layoutForSchema(
    await fetchModelSchema(model, { strict: true }),
    shotAspectRatio,
  )
}
