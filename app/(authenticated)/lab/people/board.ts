'use client'

/**
 * The board: which faces are on it, which press each came from, and which one
 * it was riffed off (#578).
 *
 * **The pictures are not here.** Every tile is an ordinary `user_images` row,
 * reserved at press time and settled by the app's own polling -- so a refresh
 * keeps them, they appear in Images, the spend appears in Activity, and
 * discard is the gallery's own delete. The board held FAL urls in the browser
 * for a day instead, on the logic that a triage board is thrown away; that
 * bought nothing and cost all four of those, plus a Keep button to explain.
 *
 * What is left here is the only thing the library does not know: the order,
 * which press each face belongs to, and which face a riff came from. Keyed by
 * record id and kept in `localStorage` -- so a row that has since been deleted
 * simply has no tile to draw.
 *
 * **The board is a stack of sets, one per Generate.** A press is judged whole
 * -- ten faces shot the same afternoon -- so a set is drawn between rules and
 * never interleaved with another. Everything spawned off a face stays inside
 * that set, below the cast it came from: a `+` is a follow-up question about
 * one of these ten, not a new press.
 *
 * Pure and separate from the view so the placement can be tested without
 * rendering anything -- it is the half that is easy to get subtly wrong.
 */

const KEY = 'genzen:lab:people:board'

export interface Tile {
  /** The `user_images` row this tile is. */
  recordId: string
  /** The Generate press it belongs to. A riff inherits its parent's, which is
   *  what keeps a follow-up inside the set it asked about. */
  batchKey: string
  /** The paragraph that made it, carried so a riff can be written from it. */
  spec: string
  /** The tile this one was spawned from, if any. */
  parentKey: string | null
}

/** How many tiles were spawned directly off this one -- the badge. */
export function childCount(tiles: Array<Tile>, recordId: string): number {
  return tiles.filter((t) => t.parentKey === recordId).length
}

/**
 * Where new tiles go.
 *
 * **A press with no parent appends a set**, so a second Generate adds a block
 * below rather than extending the row above.
 *
 * **A riff appends inside its parent's set, after everything already there.**
 * Not directly beside the parent: a set is judged as a set, and a tile dropped
 * into the middle of the cast moves the faces being compared. Order within a
 * set is press order, and a tile takes its slot the moment it is pressed even
 * though it fills in later -- so a press made while three others are still
 * rendering lands after those three rather than jumping ahead of them.
 */
export function insertTiles(
  tiles: Array<Tile>,
  added: Array<Tile>,
  parentKey?: string | null,
): Array<Tile> {
  if (!parentKey) return [...tiles, ...added]

  const parent = tiles.find((t) => t.recordId === parentKey)
  if (!parent) return [...tiles, ...added]

  let at = tiles.length
  while (at > 0 && tiles[at - 1].batchKey !== parent.batchKey) at -= 1

  return [...tiles.slice(0, at), ...added, ...tiles.slice(at)]
}

/** The set a lone press joins: the most recent one on the board. Pressing
 *  Generate Person over and over grows one block rather than drawing a rule
 *  between every face. */
export function lastBatchKey(tiles: Array<Tile>): string | null {
  return tiles.at(-1)?.batchKey ?? null
}

/** The board as sets, in the order they were pressed -- the cast of each, then
 *  everything spawned from it. */
export function bySet(
  tiles: Array<Tile>,
): Array<{ batchKey: string; cast: Array<Tile>; more: Array<Tile> }> {
  const order: Array<string> = []
  const sets = new Map<string, { cast: Array<Tile>; more: Array<Tile> }>()

  for (const tile of tiles) {
    let set = sets.get(tile.batchKey)
    if (!set) {
      set = { cast: [], more: [] }
      sets.set(tile.batchKey, set)
      order.push(tile.batchKey)
    }
    if (tile.parentKey) set.more.push(tile)
    else set.cast.push(tile)
  }

  return order.map((batchKey) => ({ batchKey, ...sets.get(batchKey)! }))
}

export function readBoard(): Array<Tile> {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return []
  }
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is Tile =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as Tile).recordId === 'string' &&
        typeof (t as Tile).batchKey === 'string',
    )
  } catch {
    return []
  }
}

export function writeBoard(tiles: Array<Tile>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tiles))
  } catch {
    // A blocked store costs the layout of a board whose pictures are all still
    // in the library. Not worth failing a press over.
  }
}
