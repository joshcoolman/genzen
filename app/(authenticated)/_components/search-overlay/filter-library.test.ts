import { describe, expect, it } from 'vitest'
import { filterLibrary } from './filter-library'
import type { LibraryIndexRow } from '#/features/user-images/server/library-index.action'

function row(partial: Partial<LibraryIndexRow>): LibraryIndexRow {
  return {
    id: 'id',
    title: 'Untitled',
    origin: 'images',
    createdAt: '2026-07-31T00:00:00.000Z',
    prompt: null,
    ...partial,
  }
}

const GENERATION = row({
  id: 'gen',
  title: 'Space Battle',
  origin: 'images',
  prompt: 'a vast space battle over a ringed planet',
})

const UPLOAD = row({
  id: 'up',
  title: 'Product Shot Backdrop',
  origin: 'upload',
  prompt: null,
})

describe('filterLibrary', () => {
  it('matches an upload on its title, which is all it has', () => {
    // The failure this guards is the ticket's own: match prompts only, and
    // every uploaded image becomes invisible in the surface meant to hold
    // everything.
    expect(filterLibrary([GENERATION, UPLOAD], 'backdrop', 'all')).toEqual([
      UPLOAD,
    ])
  })

  it('matches a generation on its prompt', () => {
    expect(filterLibrary([GENERATION, UPLOAD], 'ringed', 'all')).toEqual([
      GENERATION,
    ])
  })

  it('splits generations from uploads by origin', () => {
    const canvasGen = row({ id: 'canvas', origin: 'canvas' })
    const rows = [GENERATION, UPLOAD, canvasGen]

    expect(filterLibrary(rows, '', 'uploads')).toEqual([UPLOAD])
    // Canvas is a generation too -- "generations" is everything that is not an
    // upload, not a hardcoded list of the other origins.
    expect(filterLibrary(rows, '', 'generations')).toEqual([
      GENERATION,
      canvasGen,
    ])
    expect(filterLibrary(rows, '', 'all')).toEqual(rows)
  })

  it('ignores case and surrounding whitespace in the query', () => {
    expect(filterLibrary([GENERATION], '  SPACE  ', 'all')).toEqual([
      GENERATION,
    ])
  })
})
