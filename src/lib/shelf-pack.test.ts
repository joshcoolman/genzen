import { describe, expect, it } from 'vitest'
import { bestLayout, shelfPack } from './shelf-pack'

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

describe('shelfPack', () => {
  it('places every image once, at its own size', () => {
    const layout = shelfPack(MIXED, 3200)
    expect(layout.placements).toHaveLength(MIXED.length)
    expect(new Set(layout.placements.map((p) => p.index)).size).toBe(
      MIXED.length,
    )
    for (const p of layout.placements) {
      expect({ width: p.width, height: p.height }).toEqual({
        width: MIXED[p.index].width,
        height: MIXED[p.index].height,
      })
    }
  })

  it('keeps every image inside the sheet', () => {
    const layout = shelfPack(MIXED, 3200)
    for (const p of layout.placements) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x + p.width).toBeLessThanOrEqual(layout.width)
      expect(p.y + p.height).toBeLessThanOrEqual(layout.height)
    }
  })

  it('never overlaps two images', () => {
    const { placements } = shelfPack(MIXED, 3200)
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

  it('gives an image wider than the row a row of its own rather than cropping it', () => {
    const layout = shelfPack([{ width: 4000, height: 500 }], 1600)
    expect(layout.width).toBe(4000)
    expect(layout.placements[0]).toMatchObject({ x: 0, y: 0, width: 4000 })
  })
})

describe('bestLayout', () => {
  it('packs mixed ratios into something roughly square and mostly full', () => {
    const layout = bestLayout(MIXED)
    expect(layout.placements).toHaveLength(MIXED.length)
    // ~27% background is the floor for mixed ratios packed without resizing.
    expect(layout.fill).toBeGreaterThan(0.6)
    const ratio = layout.width / layout.height
    expect(ratio).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(2)
  })

  it('is deterministic', () => {
    expect(bestLayout(MIXED)).toEqual(bestLayout(MIXED))
  })

  it('handles one image and none at all', () => {
    expect(bestLayout([])).toMatchObject({ width: 0, height: 0, rows: 0 })
    const one = bestLayout([{ width: 1024, height: 768 }])
    expect(one).toMatchObject({ width: 1024, height: 768, rows: 1, fill: 1 })
  })
})
