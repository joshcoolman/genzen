/**
 * Laying mixed-ratio images out as justified rows -- every row exactly as wide
 * as the sheet, every image in a row the same height (#476).
 *
 * **This replaced packing at native size, and the reason is worth keeping.**
 * The first pass placed each picture at its own pixel dimensions and scaled the
 * finished sheet once at the end, so cell size on the sheet was source
 * resolution: a 1536x768 frame landed at twice the area of a 720x1280 one, and
 * two pictures of the same shape came out different sizes. Nothing downstream
 * wanted that -- the sheet is downscaled for the model anyway, so native pixels
 * bought nothing and cost the one property the sheet is supposed to have, which
 * is that every cell gets an equal share of it.
 *
 * Pure arithmetic on aspect ratios; no pixels are touched here.
 */

export interface LayoutItem {
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
  /** Fraction of the sheet covered by pictures. Justified rows fill it, so this
   *  is ~1 -- it stays on the type because the caller reports it and a number
   *  that stopped being 1 would mean a real bug. */
  fill: number
  placements: Array<Placement>
}

const EPSILON = 1e-9

function aspectOf(item: LayoutItem): number {
  return item.height > 0 ? item.width / item.height : 1
}

/**
 * How many rows a set of this shape wants, for a sheet of a given proportion.
 *
 * A row justified to width `W` whose aspects sum to `s` is `W / s` tall. Split
 * `N` images into `R` rows and each row carries about `A / R` of the total
 * aspect `A`, so the sheet is about `R² · W / A` tall -- and setting that equal
 * to `W` gives `R = √A`. For a target proportion `S = W / H` it is `√(A / S)`;
 * square is just `S = 1`.
 *
 * So all-square images want `√N` rows, 16:9 images want `√(1.78 N)` -- more
 * rows, which is right -- and portraits want fewer. Orientation is never
 * special-cased; the aspect sum already carries it.
 */
export function idealRowCount(items: Array<LayoutItem>, sheetAspect = 1) {
  const total = items.reduce((sum, item) => sum + aspectOf(item), 0)
  return Math.sqrt(total / sheetAspect)
}

/**
 * Split items into `rows` contiguous groups with rows as close to equally tall
 * as possible.
 *
 * Contiguous because the selection's order is the sheet's order -- reordering
 * to pack better would make the sheet stop matching the grid it came from.
 * Exact rather than greedy: a running-sum greedy leaves one lumpy row often
 * enough to see, and at these sizes the DP is free.
 *
 * Cost is squared deviation from the target height, which is the usual
 * justified-text objective and is what stops one very short row paying for
 * three slightly tall ones.
 */
function partition(
  aspects: Array<number>,
  rows: number,
): Array<[number, number]> {
  const n = aspects.length
  const prefix = [0]
  for (const aspect of aspects) prefix.push(prefix[prefix.length - 1] + aspect)
  const total = prefix[n]
  // Heights are in units of sheet width, so the target is 1 / (A / R).
  const target = rows / total

  const cost = Array.from({ length: rows + 1 }, () =>
    new Array<number>(n + 1).fill(Infinity),
  )
  const cut = Array.from({ length: rows + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  )
  cost[0][0] = 0

  for (let r = 1; r <= rows; r++) {
    for (let end = r; end <= n; end++) {
      for (let start = r - 1; start < end; start++) {
        if (cost[r - 1][start] === Infinity) continue
        const aspectSum = prefix[end] - prefix[start]
        if (aspectSum <= EPSILON) continue
        const deviation = 1 / aspectSum - target
        const candidate = cost[r - 1][start] + deviation * deviation
        if (candidate < cost[r][end]) {
          cost[r][end] = candidate
          cut[r][end] = start
        }
      }
    }
  }

  const bounds: Array<[number, number]> = []
  let end = n
  for (let r = rows; r >= 1; r--) {
    const start = cut[r][end]
    bounds.unshift([start, end])
    end = start
  }
  return bounds
}

/** Lay the items out in `rows` rows across a sheet `width` wide. */
function layoutInRows(
  items: Array<LayoutItem>,
  rows: number,
  width: number,
): Layout {
  const aspects = items.map(aspectOf)
  const bounds = partition(aspects, rows)

  const placements: Array<Placement> = []
  let y = 0

  for (const [start, end] of bounds) {
    const aspectSum = aspects
      .slice(start, end)
      .reduce((sum, aspect) => sum + aspect, 0)
    const rowHeight = Math.max(1, Math.round(width / aspectSum))

    let x = 0
    for (let i = start; i < end; i++) {
      // The last cell in a row takes whatever the rounding left, so the row is
      // exactly the sheet's width rather than a pixel short of it.
      const cellWidth =
        i === end - 1
          ? width - x
          : Math.max(1, Math.round(aspects[i] * rowHeight))
      placements.push({ index: i, x, y, width: cellWidth, height: rowHeight })
      x += cellWidth
    }
    y += rowHeight
  }

  const covered = placements.reduce(
    (sum, placement) => sum + placement.width * placement.height,
    0,
  )
  const height = y

  return {
    width,
    height,
    rows: bounds.length,
    fill: height ? covered / (width * height) : 0,
    placements,
  }
}

/**
 * The sheet: as square as this set of shapes allows, at `longEdge` on its
 * longer side.
 *
 * `√A` is rarely a whole number, so the two nearest row counts are laid out and
 * the squarer one wins; ties go to fewer rows, which makes the result
 * deterministic and slightly favours bigger cells.
 *
 * Cell height comes out at about `longEdge / √A`, which is the number that
 * decides whether a sheet is usable: at 2048, six square cells are ~836px each
 * and forty are ~324px. That is the budget the caller reports.
 */
export function justifiedLayout(
  items: Array<LayoutItem>,
  longEdge: number,
): Layout {
  if (items.length === 0) {
    return { width: 0, height: 0, rows: 0, fill: 0, placements: [] }
  }

  const ideal = idealRowCount(items)
  const candidates = [...new Set([Math.floor(ideal), Math.ceil(ideal)])]
    .map((rows) => Math.min(items.length, Math.max(1, rows)))
    .sort((a, b) => a - b)

  let best: Layout | null = null
  for (const rows of [...new Set(candidates)]) {
    // Lay out against a unit width first: the shape of the sheet does not
    // depend on its scale, and only the winner needs real numbers.
    const shape = layoutInRows(items, rows, 10_000)
    const aspect = shape.width / shape.height
    const width = Math.round(aspect >= 1 ? longEdge : longEdge * aspect)
    const layout = layoutInRows(items, rows, width)
    const squareness =
      Math.min(layout.width, layout.height) /
      Math.max(layout.width, layout.height)
    const bestSquareness = best
      ? Math.min(best.width, best.height) / Math.max(best.width, best.height)
      : -1
    if (squareness > bestSquareness) best = layout
  }

  return best!
}
