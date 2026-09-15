import { describe, expect, it } from 'vitest'
import { playableClips, toPlayableIndex, toRowIndex } from './run'
import type { VideoRecord } from '../../video/_actions/generate-video.action'

/** Only the two fields the mapping reads. */
const clip = (id: string, status = 'completed') =>
  ({ id, status }) as VideoRecord

/**
 * The row and the player hold different lists, and a clip being made is the
 * difference between them. Every case here is an off-by-one that would send a
 * click to the wrong clip -- which on this page is invisible, because playing
 * the wrong clip looks exactly like playing the right one.
 */
describe('mapping a run to what the player can play', () => {
  const run = [
    clip('a'),
    clip('b', 'pending'),
    clip('c'),
    clip('d', 'pending'),
    clip('e'),
  ]

  it('leaves out the clips still being made', () => {
    expect(playableClips(run).map((c) => c.id)).toEqual(['a', 'c', 'e'])
  })

  it('shifts a row position down by the pending clips before it', () => {
    expect(toPlayableIndex(run, 0)).toBe(0)
    expect(toPlayableIndex(run, 2)).toBe(1)
    expect(toPlayableIndex(run, 4)).toBe(2)
  })

  it('refuses a clip the player does not have', () => {
    expect(toPlayableIndex(run, 1)).toBe(-1)
    expect(toPlayableIndex(run, 3)).toBe(-1)
    expect(toPlayableIndex(run, 9)).toBe(-1)
    // `at(-1)` would answer with the last clip, which is not what row -1 means.
    expect(toPlayableIndex(run, -1)).toBe(-1)
  })

  it('maps back to the row the tile is actually in', () => {
    expect(toRowIndex(run, 0)).toBe(0)
    expect(toRowIndex(run, 1)).toBe(2)
    expect(toRowIndex(run, 2)).toBe(4)
    expect(toRowIndex(run, null)).toBeNull()
    expect(toRowIndex(run, 3)).toBeNull()
  })

  it('round-trips every playable position', () => {
    playableClips(run).forEach((_, index) => {
      expect(toPlayableIndex(run, toRowIndex(run, index)!)).toBe(index)
    })
  })

  it('has nothing to map in an empty run', () => {
    expect(toPlayableIndex([], 0)).toBe(-1)
    expect(toRowIndex([], 0)).toBeNull()
  })
})
