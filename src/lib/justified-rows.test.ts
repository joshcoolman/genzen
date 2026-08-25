import { describe, expect, it } from 'vitest'
import { idealRowCount, justifiedLayout } from './justified-rows'

const LONG_EDGE = 2048

const MIXED = [
  { width: 1024, height: 1024 },
  { width: 960, height: 1200 },
  { width: 1536, height: 768 },
  { width: 832, height: 1216 },
  { width: 720, height: 1280 },
  { width: 1024, height: 1024 },
  { width: 1216, height: 832 },
  { width: 768, height: 1536 },
  { width: 1200, height: 960 },
  { width: 1024, height: 1024 },
  { width: 1280, height: 720 },
]

const squares = (n: number, size = 1024) =>
  Array.from({ length: n }, () => ({ width: size, height: size }))

describe('idealRowCount', () => {
  it('is the square root of the aspect sum', () => {
    // All square: A = N, so R = sqrt(N).
    expect(idealRowCount(squares(16))).toBeCloseTo(4)
    // All 16:9: A = 1.78N, so wide images want more rows.
    const wide = Array.from({ length: 16 }, () => ({
      width: 1600,
      height: 900,
    }))
    expect(idealRowCount(wide)).toBeCloseTo(Math.sqrt(16 * (16 / 9)), 5)
    // Portrait wants fewer.
    const tall = Array.from({ length: 16 }, () => ({
      width: 800,
      height: 1200,
    }))
    expect(idealRowCount(tall)).toBeLessThan(idealRowCount(squares(16)))
  })
})

describe('justifiedLayout', () => {
  it('places every image once, keeping the order it was given', () => {
    const layout = justifiedLayout(MIXED, LONG_EDGE)
    expect(layout.placements.map((p) => p.index)).toEqual(
      MIXED.map((_, i) => i),
    )
  })

  it('fills the sheet -- every row is exactly its full width', () => {
    const layout = justifiedLayout(MIXED, LONG_EDGE)
    const rows = new Map<number, Array<(typeof layout.placements)[number]>>()
    for (const placement of layout.placements) {
      rows.set(placement.y, [...(rows.get(placement.y) ?? []), placement])
    }
    for (const row of rows.values()) {
      const right = Math.max(...row.map((p) => p.x + p.width))
      expect(right).toBe(layout.width)
      // One height per row is the whole point of justifying.
      expect(new Set(row.map((p) => p.height)).size).toBe(1)
    }
    expect(layout.fill).toBeGreaterThan(0.99)
  })

  it('gives images of the same shape the same size', () => {
    const layout = justifiedLayout(squares(12), LONG_EDGE)
    const areas = new Set(layout.placements.map((p) => p.width * p.height))
    // Rounding can differ by a pixel; shapes must not differ by more.
    const sizes = [...areas].map(Math.sqrt)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(2)
  })

  it('preserves each image aspect ratio', () => {
    const layout = justifiedLayout(MIXED, LONG_EDGE)
    for (const placement of layout.placements) {
      const source = MIXED[placement.index]
      const want = source.width / source.height
      const got = placement.width / placement.height
      expect(Math.abs(got - want) / want).toBeLessThan(0.05)
    }
  })

  it('never overlaps and never leaves the sheet', () => {
    const { placements, width, height } = justifiedLayout(MIXED, LONG_EDGE)
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x + p.width).toBeLessThanOrEqual(width)
      expect(p.y + p.height).toBeLessThanOrEqual(height)
    }
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i]
        const b = placements[j]
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
    }
  })

  it('stays roughly square as the count grows', () => {
    // From six up. Two squares are 2:1 whichever way you put them, and no
    // choice of rows makes a set of two squarer than the pair itself.
    for (const n of [6, 11, 24, 40]) {
      const layout = justifiedLayout(squares(n), LONG_EDGE)
      const ratio = layout.width / layout.height
      expect(ratio).toBeGreaterThan(0.6)
      expect(ratio).toBeLessThan(1.7)
      expect(Math.max(layout.width, layout.height)).toBe(LONG_EDGE)
    }
  })

  it('handles one image and none at all', () => {
    expect(justifiedLayout([], LONG_EDGE)).toMatchObject({ rows: 0 })
    const one = justifiedLayout([{ width: 1024, height: 768 }], LONG_EDGE)
    expect(one).toMatchObject({ rows: 1, width: LONG_EDGE })
    expect(one.height).toBe(Math.round((LONG_EDGE * 768) / 1024))
  })

  it('is deterministic', () => {
    expect(justifiedLayout(MIXED, LONG_EDGE)).toEqual(
      justifiedLayout(MIXED, LONG_EDGE),
    )
  })
})
