import { describe, expect, it } from 'vitest'
import { sanitizeFileName, zipEntryName } from './zip-names'

describe('zipEntryName', () => {
  it('numbers from one and pads to the width of the set', () => {
    expect(zipEntryName('image', 0, 11, 'a.png')).toBe('image-01.png')
    expect(zipEntryName('image', 10, 11, 'a.png')).toBe('image-11.png')
    expect(zipEntryName('image', 0, 100, 'a.png')).toBe('image-001.png')
  })

  it('sorts lexically in the order the images came in', () => {
    const total = 11
    const names = Array.from({ length: total }, (_, i) =>
      zipEntryName('image', i, total, 'a.png'),
    )
    expect([...names].sort()).toEqual(names)
  })

  it('keeps the source extension, falling back to png', () => {
    expect(zipEntryName('shot', 0, 3, 'thing.jpg')).toBe('shot-01.jpg')
    expect(zipEntryName('shot', 0, 3, 'no-extension')).toBe('shot-01.png')
  })
})

describe('sanitizeFileName', () => {
  it('strips what the OS would read as a path', () => {
    expect(sanitizeFileName(' a/b:c ')).toBe('a-b-c')
  })
})
