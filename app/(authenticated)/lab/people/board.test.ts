import { describe, expect, it } from 'vitest'
import { bySet, childCount, insertTiles, lastBatchKey } from './board'
import type { Tile } from './board'

let n = 0
function tile(
  spec: string,
  opts?: { parentKey?: string; batchKey?: string },
): Tile {
  n += 1
  return {
    recordId: `row-${n}`,
    spec,
    batchKey: opts?.batchKey ?? 'set-1',
    parentKey: opts?.parentKey ?? null,
  }
}

describe('the board', () => {
  it('appends a press with no parent, so a second Generate adds a row', () => {
    const first = [tile('a'), tile('b')]
    const next = insertTiles(first, [tile('c')])

    expect(next.map((t) => t.spec)).toEqual(['a', 'b', 'c'])
  })

  it('puts a riff under its own set, not at the end of the board', () => {
    const first = tile('a')
    const board = [first, tile('b'), tile('c', { batchKey: 'set-2' })]

    const next = insertTiles(
      board,
      [tile('a2', { parentKey: first.recordId })],
      first.recordId,
    )

    expect(next.map((t) => t.spec)).toEqual(['a', 'b', 'a2', 'c'])
  })

  it('keeps riffs in press order within their set', () => {
    const parent = tile('a')
    const board = insertTiles(
      [parent, tile('b')],
      [tile('a2', { parentKey: parent.recordId })],
      parent.recordId,
    )

    const next = insertTiles(
      board,
      [tile('b2', { parentKey: parent.recordId })],
      parent.recordId,
    )

    expect(next.map((t) => t.spec)).toEqual(['a', 'b', 'a2', 'b2'])
  })

  it('splits a set into its cast and what was asked about it', () => {
    const parent = tile('a')
    const board = [
      parent,
      tile('b'),
      tile('a2', { parentKey: parent.recordId }),
      tile('c', { batchKey: 'set-2' }),
    ]

    const sets = bySet(board)

    expect(sets.map((s) => s.batchKey)).toEqual(['set-1', 'set-2'])
    expect(sets[0].cast.map((t) => t.spec)).toEqual(['a', 'b'])
    expect(sets[0].more.map((t) => t.spec)).toEqual(['a2'])
    expect(sets[1].more).toEqual([])
  })

  it('joins a lone press to the most recent set', () => {
    const board = [tile('a'), tile('b', { batchKey: 'set-2' })]

    expect(lastBatchKey(board)).toBe('set-2')
    expect(lastBatchKey([])).toBeNull()
  })

  it('counts direct children only -- the badge is not a descendant count', () => {
    const parent = tile('a')
    const child = tile('a2', { parentKey: parent.recordId })
    const grandchild = tile('a3', { parentKey: child.recordId })

    const board = [parent, child, grandchild]

    expect(childCount(board, parent.recordId)).toBe(1)
    expect(childCount(board, child.recordId)).toBe(1)
  })
})
