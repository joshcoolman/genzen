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
 * **A child lands directly after its parent's family, not at the end.** You
 * press `+` because you want to compare against the face you pressed it on,
 * and a family scattered twenty tiles apart is not a comparison. The cost is
 * that a press shifts everything after it, which is the lesser problem.
 *
 * Pure and separate from the view so the placement can be tested without
 * rendering anything -- it is the half that is easy to get subtly wrong.
 */

const KEY = 'genzen:lab:people:board'

export interface Tile {
  key: string
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
  init: Pick<Tile, 'spec' | 'modelId' | 'modelName'> & { parentKey?: string },
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
 * Place new tiles after the parent and after any children it already has, so
 * pressing `+` three times reads left to right in the order you pressed it
 * rather than stacking backwards. With no parent they go on the end, which is
 * what makes a second Generate add a row rather than replace the board.
 */
export function insertTiles(
  tiles: Array<Tile>,
  added: Array<Tile>,
  parentKey?: string | null,
): Array<Tile> {
  if (!parentKey) return [...tiles, ...added]

  const parentAt = tiles.findIndex((t) => t.key === parentKey)
  if (parentAt === -1) return [...tiles, ...added]

  let at = parentAt + 1
  while (at < tiles.length && tiles[at].parentKey === parentKey) at += 1

  return [...tiles.slice(0, at), ...added, ...tiles.slice(at)]
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
          !!t && typeof t === 'object' && typeof (t as Tile).key === 'string',
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
