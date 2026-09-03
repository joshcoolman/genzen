'use client'

/**
 * The board: what is on it, where a new tile lands, and how it survives a
 * refresh (#578).
 *
 * **Nothing here is in the database.** A press is a scan for a face worth
 * pursuing, and most tiles are rejected -- rows created for those would be rows
 * to go and delete. Keep is the only thing that writes, which is the same bet
 * `lab/lighting/_actions/render-candidate.action.ts` makes and for the same
 * reason. The costs are real and named on the page: these runs do not appear
 * in Activity, and the FAL urls a saved board holds expire, so a board left
 * overnight comes back with dead tiles.
 *
 * **The board is a stack of sets, one per Generate.** A press is a thing you
 * judge whole -- ten faces shot the same afternoon -- so a set is drawn between
 * rules and never interleaved with another. Everything spawned off a tile in a
 * set stays inside that set, below the cast it came from: a `+` is a follow-up
 * question about one of these ten, not a new press.
 *
 * Pure and separate from the view so the placement can be tested without
 * rendering anything -- it is the half that is easy to get subtly wrong.
 */

const KEY = 'genzen:lab:people:board'

export interface Tile {
  key: string
  /** The Generate press this tile belongs to. Children inherit their parent's,
   *  which is what keeps a follow-up inside the set it asked about. */
  batchKey: string
  /** The paragraph that made it. Carried so a child can be written from it. */
  spec: string
  modelId: string
  modelName: string
  status: 'running' | 'done' | 'failed' | 'expired'
  url: string | null
  error: string | null
  /** The tile this one was spawned from, if any. */
  parentKey: string | null
  /** Set once Keep has written a library row. */
  keptImageId: string | null
}

export function newTile(
  init: Pick<Tile, 'spec' | 'modelId' | 'modelName' | 'batchKey'> & {
    parentKey?: string
  },
): Tile {
  return {
    key: crypto.randomUUID(),
    status: 'running',
    url: null,
    error: null,
    parentKey: init.parentKey ?? null,
    keptImageId: null,
    ...init,
  }
}

/** How many tiles were spawned directly off this one -- the badge. */
export function childCount(tiles: Array<Tile>, key: string): number {
  return tiles.filter((t) => t.parentKey === key).length
}

/**
 * Where new tiles go.
 *
 * **A press with no parent appends a set**, so a second Generate adds a block
 * below rather than replacing the board.
 *
 * **A `+` or a riff appends inside its parent's set, after everything already
 * there.** Not directly beside the parent: a set is judged as a set, and tiles
 * dropped into the middle of the cast move the faces being compared. Order
 * within a set is press order, and a tile takes its slot the moment it is
 * pressed even though it fills in later -- so a press made while three others
 * are still rendering lands after those three rather than jumping ahead of
 * them.
 */
export function insertTiles(
  tiles: Array<Tile>,
  added: Array<Tile>,
  parentKey?: string | null,
): Array<Tile> {
  if (!parentKey) return [...tiles, ...added]

  const parent = tiles.find((t) => t.key === parentKey)
  if (!parent) return [...tiles, ...added]

  let at = tiles.length
  while (at > 0 && tiles[at - 1].batchKey !== parent.batchKey) at -= 1

  return [...tiles.slice(0, at), ...added, ...tiles.slice(at)]
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
    return parsed
      .filter(
        (t): t is Tile =>
          !!t &&
          typeof t === 'object' &&
          typeof (t as Tile).key === 'string' &&
          // Boards saved before sets existed have no batch to belong to. There
          // is one such board, on one machine, and inventing a set for it is
          // more code than the board is worth.
          typeof (t as Tile).batchKey === 'string',
      )
      .map((t) => ({
        ...t,
        // A tile that was mid-flight when the tab closed has no result coming:
        // the render is a plain await, so nothing reconciles it on load.
        status: t.status === 'running' ? 'failed' : t.status,
        error: t.status === 'running' ? 'Interrupted' : t.error,
      }))
  } catch {
    return []
  }
}

export function writeBoard(tiles: Array<Tile>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tiles))
  } catch {
    // A full or blocked store costs a refresh, not a generation. The board is
    // on screen either way.
  }
}
