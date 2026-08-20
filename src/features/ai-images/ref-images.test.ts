import { describe, expect, it } from 'vitest'
import { imageLabelPrefix, pushRef } from './ref-images'
import type { RefImage } from './hooks/use-generator'

const ref = (id: string): RefImage => ({ id, url: `/img/${id}`, title: id })

describe('pushRef', () => {
  it('keeps everything that was there, newest first', () => {
    // It evicted past a cap until #341. Nothing is dropped now: the submit
    // truncates per model and says so, so the strip has no reason to.
    const strip = [ref('a'), ref('b'), ref('c')]
    expect(pushRef(strip, ref('d')).map((r) => r.id)).toEqual([
      'd',
      'a',
      'b',
      'c',
    ])
  })

  it('moves an image already in the strip to the front rather than duplicating', () => {
    const strip = [ref('a'), ref('b'), ref('c')]
    expect(pushRef(strip, ref('c')).map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('adds to an empty strip', () => {
    expect(pushRef([], ref('a')).map((r) => r.id)).toEqual(['a'])
  })
})

describe('imageLabelPrefix', () => {
  it('numbers every image in the set, in order', () => {
    // The numbers are positions in the array the submit sends, and the prompts
    // Variations writes name them (#436). Off by one here is a prompt about a
    // different picture, with nothing on screen to say so.
    expect(imageLabelPrefix(3)).toBe('[Image 1, Image 2, Image 3]\n\n')
  })

  it('says nothing about a set of one, or none', () => {
    expect(imageLabelPrefix(1)).toBe('')
    expect(imageLabelPrefix(0)).toBe('')
  })
})
