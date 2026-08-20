export interface MasonryItem {
  id: string
  width: number
  height: number
}

export interface MasonryResult {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * Classic column-based masonry layout.
 *
 * Every image is resized to fill the column width (preserving aspect ratio),
 * then placed in the shortest column. Column width is the median of input
 * widths so most images stay close to their original size.
 */
export function layoutMasonry(
  items: Array<MasonryItem>,
  columns: number,
  originX: number,
  originY: number,
  colWidth?: number,
  gap = 16,
): Array<MasonryResult> {
  if (items.length === 0) return []

  const cols = Math.min(columns, items.length)

  // Column width: use provided value, or median of input widths
  const cw =
    colWidth ??
    (() => {
      const widths = items.map((i) => i.width).sort((a, b) => a - b)
      return widths[Math.floor(widths.length / 2)]
    })()

  const totalWidth = cols * cw + (cols - 1) * gap
  const colHeights = new Array(cols).fill(0)
  const results: Array<MasonryResult> = []

  for (const item of items) {
    // Scale to column width, preserving aspect ratio
    const scale = cw / item.width
    const w = cw
    const h = Math.round(item.height * scale)

    // Place in shortest column
    const col = colHeights.indexOf(Math.min(...colHeights))
    const x = originX - totalWidth / 2 + col * (cw + gap)
    const y = originY + colHeights[col]

    results.push({ id: item.id, x, y, width: w, height: h })
    colHeights[col] += h + gap
  }

  return results
}
