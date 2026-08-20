import type { CanvasImage } from './types'

/** Zoom range. 1.0 is native pixels; the floor is low enough to hold a very
 *  large arrangement in one screen. */
export const MIN_SCALE = 0.02
export const MAX_SCALE = 1.0
export const DEFAULT_SCALE = 0.5

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

/** Sort images in reading order (top-to-bottom, left-to-right) to preserve
 *  the rough spatial layout the user arranged before grouping/arranging. */
export function spatialSort(imgs: Array<CanvasImage>): Array<CanvasImage> {
  if (imgs.length < 2) return imgs
  const sorted = [...imgs].sort((a, b) => a.y - b.y)
  // Use half the average height as the row tolerance
  const avgH = imgs.reduce((s, i) => s + i.height, 0) / imgs.length
  const rowTolerance = avgH * 0.5
  // Group into rows, then sort each row left-to-right
  const rows: Array<Array<CanvasImage>> = []
  let currentRow: Array<CanvasImage> = [sorted[0]]
  let rowY = sorted[0].y
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - rowY <= rowTolerance) {
      currentRow.push(sorted[i])
    } else {
      rows.push(currentRow.sort((a, b) => a.x - b.x))
      currentRow = [sorted[i]]
      rowY = sorted[i].y
    }
  }
  rows.push(currentRow.sort((a, b) => a.x - b.x))
  return rows.flat()
}

export function getBounds(imgs: Array<CanvasImage>): Bounds {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const img of imgs) {
    x0 = Math.min(x0, img.x)
    y0 = Math.min(y0, img.y)
    x1 = Math.max(x1, img.x + img.width)
    y1 = Math.max(y1, img.y + img.height)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** The scale that fits `bounds` into a viewport of `w` x `h`, clamped to the
 *  zoom range. `pad` is screen-space padding; `fill` takes a fraction of the
 *  viewport instead (cmd+0 focuses at 75% rather than edge-to-edge). */
export function scaleToFit(
  bounds: Bounds,
  viewport: { width: number; height: number },
  opts: { pad?: number; fill?: number } = {},
): number {
  const { pad = 0, fill = 1 } = opts
  const availW = viewport.width * fill - pad * 2
  const availH = viewport.height * fill - pad * 2
  return Math.min(
    Math.max(Math.min(availW / bounds.w, availH / bounds.h), MIN_SCALE),
    MAX_SCALE,
  )
}

/** The transform that centres `bounds` in a viewport at the given scale. */
export function centerOn(
  bounds: Bounds,
  viewport: { width: number; height: number },
  scale: number,
) {
  return {
    x: viewport.width / 2 - (bounds.x + bounds.w / 2) * scale,
    y: viewport.height / 2 - (bounds.y + bounds.h / 2) * scale,
    scale,
  }
}
