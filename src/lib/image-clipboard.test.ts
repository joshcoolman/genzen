import { describe, expect, it } from 'vitest'
import { readImageRefs } from './image-clipboard'

// The marker is the whole reason an internal paste reuses a row instead of
// uploading a second copy of it (#213). Reading it wrongly fails in one of two
// silent ways: a real marker missed (a duplicate upload appears) or a stranger's
// text claimed (a paste from another app vanishes into a lookup that finds
// nothing). Both look like "paste did nothing".
describe('readImageRefs', () => {
  it('reads the id back out of a single-image marker', () => {
    const id = '3f8c5d24-9b1e-4f6a-8c2d-1a7b9e0c4d55'
    expect(readImageRefs(`genzen:image:${id}`)).toEqual([id])
  })

  it('reads every id out of a multi-select marker (#250)', () => {
    expect(readImageRefs('genzen:image:abc,def,ghi')).toEqual([
      'abc',
      'def',
      'ghi',
    ])
  })

  it('survives the whitespace a clipboard round trip adds', () => {
    expect(readImageRefs('  genzen:image:abc\n')).toEqual(['abc'])
  })

  it('leaves text from anywhere else alone', () => {
    expect(readImageRefs('https://example.com/cat.png')).toBeNull()
    expect(
      readImageRefs('a really good prompt about a space battle'),
    ).toBeNull()
    expect(readImageRefs('')).toBeNull()
  })

  it('rejects a marker with no id rather than looking up an empty string', () => {
    expect(readImageRefs('genzen:image:')).toBeNull()
  })
})
