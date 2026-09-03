import { describe, expect, it } from 'vitest'
import { bySet, childCount, insertTiles, newTile } from './board'

function tile(spec: string, opts?: { parentKey?: string; batchKey?: string }) {
  return newTile({
    spec,
    modelId: 'fal-ai/z-image/turbo',
    modelName: 'Z-Image Turbo',
    batchKey: opts?.batchKey ?? 'set-1',
    parentKey: opts?.parentKey,
  })
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
      [tile('a2', { parentKey: first.key })],
      first.key,
    )

    expect(next.map((t) => t.spec)).toEqual(['a', 'b', 'a2', 'c'])
  })

  it('keeps riffs in press order within their set', () => {
    const parent = tile('a')
    const board = insertTiles(
      [parent, tile('b')],
      [tile('a2', { parentKey: parent.key })],
      parent.key,
    )

    const next = insertTiles(
      board,
      [tile('b2', { parentKey: parent.key })],
      parent.key,
    )

    expect(next.map((t) => t.spec)).toEqual(['a', 'b', 'a2', 'b2'])
  })

  it('splits a set into its cast and what was asked about it', () => {
    const parent = tile('a')
    const board = [
      parent,
      tile('b'),
      tile('a2', { parentKey: parent.key }),
      tile('c', { batchKey: 'set-2' }),
    ]

    const sets = bySet(board)

    expect(sets.map((s) => s.batchKey)).toEqual(['set-1', 'set-2'])
    expect(sets[0].cast.map((t) => t.spec)).toEqual(['a', 'b'])
    expect(sets[0].more.map((t) => t.spec)).toEqual(['a2'])
    expect(sets[1].more).toEqual([])
  })

  it('counts direct children only -- the badge is not a descendant count', () => {
    const parent = tile('a')
    const child = tile('a2', { parentKey: parent.key })
    const grandchild = tile('a3', { parentKey: child.key })

    const board = [parent, child, grandchild]

    expect(childCount(board, parent.key)).toBe(1)
    expect(childCount(board, child.key)).toBe(1)
  })
})
