import { describe, expect, it } from 'vitest'
import { childCount, insertTiles, newTile } from './board'
import type { Tile } from './board'

function tile(spec: string, parentKey?: string): Tile {
  return newTile({
    spec,
    modelId: 'fal-ai/z-image/turbo',
    modelName: 'Z-Image Turbo',
    parentKey,
  })
}

describe('the board', () => {
  it('appends a press with no parent, so a second Generate adds a row', () => {
    const first = [tile('a'), tile('b')]
    const next = insertTiles(first, [tile('c')])

    expect(next.map((t) => t.spec)).toEqual(['a', 'b', 'c'])
  })

  it('puts a child after its parent, not at the end of the board', () => {
    const parent = tile('a')
    const board = [parent, tile('b'), tile('c')]

    const next = insertTiles(board, [tile('a2', parent.key)], parent.key)

    expect(next.map((t) => t.spec)).toEqual(['a', 'a2', 'b', 'c'])
  })

  it('puts a second child after the first, so presses read in press order', () => {
    const parent = tile('a')
    const board = insertTiles(
      [parent, tile('b')],
      [tile('a2', parent.key)],
      parent.key,
    )

    const next = insertTiles(board, [tile('a3', parent.key)], parent.key)

    expect(next.map((t) => t.spec)).toEqual(['a', 'a2', 'a3', 'b'])
  })

  it('counts direct children only -- the badge is not a descendant count', () => {
    const parent = tile('a')
    const child = tile('a2', parent.key)
    const grandchild = tile('a3', child.key)

    const board = [parent, child, grandchild]

    expect(childCount(board, parent.key)).toBe(1)
    expect(childCount(board, child.key)).toBe(1)
  })
})
