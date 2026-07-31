import { describe, expect, it } from 'vitest'
import { readImageRef } from './image-clipboard'

// The marker is the whole reason an internal paste reuses a row instead of
// uploading a second copy of it (#213). Reading it wrongly fails in one of two
// silent ways: a real marker missed (a duplicate upload appears) or a stranger's
// text claimed (a paste from another app vanishes into a lookup that finds
// nothing). Both look like "paste did nothing".
describe('readImageRef', () => {
  it('reads the id back out of a marker', () => {
    const id = '3f8c5d24-9b1e-4f6a-8c2d-1a7b9e0c4d55'
    expect(readImageRef(`genzen:image:${id}`)).toBe(id)
  })

  it('survives the whitespace a clipboard round trip adds', () => {
    expect(readImageRef('  genzen:image:abc\n')).toBe('abc')
  })

  it('leaves text from anywhere else alone', () => {
    expect(readImageRef('https://example.com/cat.png')).toBeNull()
    expect(readImageRef('a really good prompt about a space battle')).toBeNull()
    expect(readImageRef('')).toBeNull()
  })

  it('rejects a marker with no id rather than looking up an empty string', () => {
    expect(readImageRef('genzen:image:')).toBeNull()
  })
})
