import { describe, expect, it } from 'vitest'
import { pushRef } from './ref-images'
import type { RefImage } from './hooks/use-generator'

const ref = (id: string): RefImage => ({ id, url: `/img/${id}`, title: id })

describe('pushRef', () => {
  it('evicts the last when the strip is full, keeping the newest', () => {
    const full = [ref('a'), ref('b'), ref('c')]
    expect(pushRef(full, ref('d'), 3).map((r) => r.id)).toEqual(['d', 'a', 'b'])
  })

  it('moves an image already in the strip to the front rather than duplicating', () => {
    const strip = [ref('a'), ref('b'), ref('c')]
    expect(pushRef(strip, ref('c'), 3).map((r) => r.id)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('adds without evicting while there is room', () => {
    expect(pushRef([ref('a')], ref('b'), 3).map((r) => r.id)).toEqual([
      'b',
      'a',
    ])
  })

  it('changes nothing when the model takes no references', () => {
    const strip = [ref('a')]
    expect(pushRef(strip, ref('b'), 0)).toBe(strip)
  })
})
