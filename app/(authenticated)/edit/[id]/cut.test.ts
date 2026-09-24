import { describe, expect, it } from 'vitest'
import {
  formatClock,
  locate,
  playableOf,
  splitSpan,
  startOf,
  toPlayableIndex,
  toRowIndex,
  totalSeconds,
} from './cut'

const spans = [
  { in: 0, out: 5 },
  { in: 1, out: 3 },
  { in: 2.5, out: 6 },
]

describe('cut arithmetic', () => {
  it('sums trimmed lengths, not file lengths', () => {
    expect(startOf(spans, 0)).toBe(0)
    expect(startOf(spans, 1)).toBe(5)
    expect(startOf(spans, 2)).toBe(7)
    expect(totalSeconds(spans)).toBe(10.5)
  })

  it('locates a moment in the clip it falls in', () => {
    expect(locate(spans, 0)).toEqual({ index: 0, offset: 0 })
    expect(locate(spans, 4.9)).toEqual({ index: 0, offset: 4.9 })
    expect(locate(spans, 5)).toEqual({ index: 1, offset: 0 })
    expect(locate(spans, 8)).toEqual({ index: 2, offset: 1 })
  })

  it('lands past the end on the last clip, and nowhere on an empty run', () => {
    expect(locate(spans, 99)).toEqual({ index: 2, offset: 3.5 })
    expect(locate([], 1)).toBeNull()
  })

  it('splits a span in two, and refuses a split at the edge', () => {
    expect(splitSpan({ in: 1, out: 4 }, 1.5)).toEqual([
      { in: 1, out: 2.5 },
      { in: 2.5, out: 4 },
    ])
    expect(splitSpan({ in: 1, out: 4 }, 0.1)).toBeNull()
    expect(splitSpan({ in: 1, out: 4 }, 2.95)).toBeNull()
  })

  it('indexes the strip and the player apart when a row is pending', () => {
    const done = { status: 'completed' }
    const rows = [
      { in: 0, out: 2, clip: done },
      { in: 0, out: 5, clip: { status: 'pending' } },
      { in: 1, out: 3, clip: done },
    ]
    expect(playableOf(rows)).toHaveLength(2)
    expect(toPlayableIndex(rows, 0)).toBe(0)
    expect(toPlayableIndex(rows, 1)).toBe(-1)
    expect(toPlayableIndex(rows, 2)).toBe(1)
    expect(toRowIndex(rows, 1)).toBe(2)
    expect(toRowIndex(rows, null)).toBeNull()
    expect(toRowIndex(rows, 5)).toBeNull()
  })

  it('formats the clock to tenths', () => {
    expect(formatClock(0)).toBe('0:00.0')
    expect(formatClock(7.26)).toBe('0:07.3')
    expect(formatClock(83.04)).toBe('1:23.0')
  })
})
