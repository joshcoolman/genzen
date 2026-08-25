/**
 * Packing mixed-ratio images into one sheet, without cropping or resizing any
 * of them (#476).
 *
 * Pure arithmetic, and that is the point: a candidate layout costs nothing to
 * evaluate, so the row width is swept rather than guessed and only the winner
 * is ever rendered.
 */

export interface PackItem {
  width: number
  height: number
}

export interface Placement {
  /** Index into the items passed in, so the caller can pair a box with bytes. */
  index: number
  x: number
  y: number
  width: number
  height: number
}

export interface Layout {
  width: number
  height: number
  rows: number
  /** Fraction of the sheet covered by pictures rather than background. */
  fill: number
  placements: Array<Placement>
}

/**
 * Shelf pack: tallest first, fill a row left to right, wrap when the next one
 * would overflow, and centre each picture vertically within its row.
 *
 * Tallest-first is what makes the rows tidy -- in arrival order, one tall
 * picture in a row of short ones sets the row's height and everything beside it
 * floats in background. Sorting groups similar heights together, so the wasted
 * band above each picture is as thin as mixed ratios allow.
 *
 * `rowWidth` is a target, not a bound: an image wider than it gets a row to
 * itself rather than being scaled down, and the sheet's real width is whatever
 * the widest row actually used.
 */
export function shelfPack(items: Array<PackItem>, rowWidth: number): Layout {
  const order = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.height - a.height || b.width - a.width)

  const placements: Array<Placement> = []
  let y = 0
  let sheetWidth = 0
  let rows = 0
  let row: Array<(typeof order)[number]> = []
  let rowUsed = 0

  function flush() {
    if (row.length === 0) return
    const rowHeight = Math.max(...row.map((item) => item.height))
    let x = 0
    for (const item of row) {
      placements.push({
        index: item.index,
        x,
        // Centred in the shelf: the background band splits above and below
        // rather than hanging under every short picture in the row.
        y: y + Math.round((rowHeight - item.height) / 2),
        width: item.width,
        height: item.height,
      })
      x += item.width
    }
    sheetWidth = Math.max(sheetWidth, rowUsed)
    y += rowHeight
    rows += 1
    row = []
    rowUsed = 0
  }

  for (const item of order) {
    if (row.length > 0 && rowUsed + item.width > rowWidth) flush()
    row.push(item)
    rowUsed += item.width
  }
  flush()

  const area = items.reduce((sum, item) => sum + item.width * item.height, 0)
  const sheetHeight = y

  return {
    width: sheetWidth,
    height: sheetHeight,
    rows,
    fill: sheetWidth && sheetHeight ? area / (sheetWidth * sheetHeight) : 0,
    placements,
  }
}

/**
 * The best layout across a sweep of row widths.
 *
 * Scored on fill times squareness, because the two failure modes are different
 * shapes of the same waste: a sheet that is mostly background, and a sheet so
 * long in one direction that fitting it on screen shrinks every cell in it.
 * Ties go to the earlier (narrower) candidate, so the result is deterministic.
 *
 * ~27% background is the floor for mixed aspect ratios packed without resizing
 * -- inherent, not a bug to tune away.
 */
export function bestLayout(items: Array<PackItem>): Layout {
  if (items.length === 0) {
    return { width: 0, height: 0, rows: 0, fill: 0, placements: [] }
  }

  // Anything narrower than the widest picture just packs one per row, and
  // laying every picture in a single row is as wide as a sweep can usefully
  // go. The upper end tracks the area rather than sitting at a fixed 6400:
  // that ceiling is generous for a dozen pictures and a straitjacket for
  // forty, where it forces a sheet several times taller than it is wide.
  const widest = Math.max(...items.map((item) => item.width))
  const total = items.reduce((sum, item) => sum + item.width, 0)
  const area = items.reduce((sum, item) => sum + item.width * item.height, 0)
  const from = Math.max(widest, 1600)
  const to = Math.max(from, Math.min(total, Math.ceil(Math.sqrt(area) * 1.6)))
  const step = 64

  let best: Layout | null = null
  let bestScore = -1
  for (let rowWidth = from; rowWidth <= to; rowWidth += step) {
    const layout = shelfPack(items, rowWidth)
    const squareness =
      Math.min(layout.width, layout.height) /
      Math.max(layout.width, layout.height)
    const score = layout.fill * squareness
    if (score > bestScore) {
      bestScore = score
      best = layout
    }
  }

  return best ?? shelfPack(items, from)
}
