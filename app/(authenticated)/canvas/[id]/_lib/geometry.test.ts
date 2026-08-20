import { describe, expect, it } from 'vitest'
import {
  MAX_SCALE,
  MIN_SCALE,
  centerOn,
  getBounds,
  scaleToFit,
  spatialSort,
} from './geometry'
import type { CanvasImage } from './types'

function img(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
): CanvasImage {
  return { id, recordId: id, storagePath: '', x, y, width, height }
}

describe('getBounds', () => {
  it('spans every corner of the set', () => {
    expect(getBounds([img('a', 0, 0), img('b', 200, 150)])).toEqual({
      x: 0,
      y: 0,
      w: 300,
      h: 250,
    })
  })
})

describe('spatialSort', () => {
  it('reads rows top-to-bottom, then left-to-right within a row', () => {
    // Two rows of two, fed in scrambled order. Row tolerance is half the
    // average height (50), so y=0 and y=10 are one row and y=400 is another.
    const out = spatialSort([
      img('bottom-right', 300, 400),
      img('top-right', 300, 10),
      img('bottom-left', 0, 400),
      img('top-left', 0, 0),
    ])
    expect(out.map((i) => i.id)).toEqual([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ])
  })

  it('leaves a set of fewer than two untouched', () => {
    const one = [img('only', 5, 5)]
    expect(spatialSort(one)).toBe(one)
  })
})

describe('scaleToFit', () => {
  const viewport = { width: 1000, height: 1000 }

  it('subtracts padding on both axes', () => {
    // (1000 - 120) / 440 = 2, clamped to MAX_SCALE
    expect(
      scaleToFit({ x: 0, y: 0, w: 440, h: 440 }, viewport, { pad: 60 }),
    ).toBe(MAX_SCALE)
    // (1000 - 120) / 8800 = 0.1
    expect(
      scaleToFit({ x: 0, y: 0, w: 8800, h: 8800 }, viewport, { pad: 60 }),
    ).toBeCloseTo(0.1)
  })

  it('takes a fraction of the viewport when asked to fill', () => {
    // 1000 * 0.75 / 1500 = 0.5
    expect(
      scaleToFit({ x: 0, y: 0, w: 1500, h: 1500 }, viewport, { fill: 0.75 }),
    ).toBeCloseTo(0.5)
  })

  it('fits the tighter axis', () => {
    // Wide-and-short bounds: height is not the constraint, width is.
    expect(scaleToFit({ x: 0, y: 0, w: 4000, h: 100 }, viewport)).toBeCloseTo(
      0.25,
    )
  })

  it('clamps to the zoom range at both ends', () => {
    expect(scaleToFit({ x: 0, y: 0, w: 1, h: 1 }, viewport)).toBe(MAX_SCALE)
    expect(scaleToFit({ x: 0, y: 0, w: 1e9, h: 1e9 }, viewport)).toBe(MIN_SCALE)
  })
})

describe('centerOn', () => {
  it('puts the middle of the bounds at the middle of the viewport', () => {
    const t = centerOn(
      { x: 100, y: 100, w: 200, h: 200 },
      { width: 1000, height: 800 },
      0.5,
    )
    // Centre of bounds is (200,200); at scale .5 that is (100,100) on screen,
    // so the offset has to put it at (500,400).
    expect(t).toEqual({ x: 400, y: 300, scale: 0.5 })
  })
})
