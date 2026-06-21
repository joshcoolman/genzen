import { describe, expect, it } from 'vitest'

import { layoutMasonry } from './masonry'
import type { MasonryItem } from './masonry'

const item = (id: string, width: number, height: number): MasonryItem => ({
  id,
  width,
  height,
})

describe('layoutMasonry', () => {
  it('returns nothing for an empty input', () => {
    expect(layoutMasonry([], 3, 0, 0)).toEqual([])
  })

  it('caps columns at the item count', () => {
    // 2 items requested across 4 columns -> only 2 columns used, so the two
    // items sit side by side (different x, same y).
    const out = layoutMasonry(
      [item('a', 100, 100), item('b', 100, 100)],
      4,
      0,
      0,
    )
    expect(out).toHaveLength(2)
    expect(out[0].y).toBe(out[1].y)
    expect(out[0].x).not.toBe(out[1].x)
  })

  it('scales each item to column width, preserving aspect ratio', () => {
    // colWidth 100 on a 200x100 item -> width 100, height halved to 50.
    const [r] = layoutMasonry([item('a', 200, 100)], 1, 0, 0, 100)
    expect(r.width).toBe(100)
    expect(r.height).toBe(50)
  })

  it('uses the median input width as the default column width', () => {
    // widths [100, 300, 500] -> median 300 becomes the column width.
    const out = layoutMasonry(
      [item('a', 100, 100), item('b', 300, 300), item('c', 500, 500)],
      3,
      0,
      0,
    )
    for (const r of out) expect(r.width).toBe(300)
  })

  it('fills columns left-to-right, breaking ties to the lowest index', () => {
    // 3 equal items, 2 columns: a->col0, b->col1, c->back to col0 (tie -> first).
    const [a, b, c] = layoutMasonry(
      [item('a', 100, 100), item('b', 100, 100), item('c', 100, 100)],
      2,
      0,
      0,
    )
    expect(a.y).toBe(0)
    expect(b.y).toBe(0)
    expect(a.x).not.toBe(b.x) // different columns
    expect(c.x).toBe(a.x) // c stacks under a (same column)
    expect(c.y).toBe(a.height + 16) // default gap below a
  })

  it('places each item in the shortest column', () => {
    // a is tall (col0 stays tall), b short (col1), c should land in the shorter
    // column (col1, under b) rather than under the tall a.
    const [a, b, c] = layoutMasonry(
      [item('a', 100, 300), item('b', 100, 100), item('c', 100, 100)],
      2,
      0,
      0,
    )
    expect(c.x).toBe(b.x) // same column as b
    expect(c.x).not.toBe(a.x)
    expect(c.y).toBe(b.height + 16)
  })

  it('honours a custom gap between stacked items', () => {
    const [a, , c] = layoutMasonry(
      [item('a', 100, 100), item('b', 100, 100), item('c', 100, 100)],
      2,
      0,
      0,
      100,
      40,
    )
    expect(c.y).toBe(a.height + 40)
  })
})
