import { describe, expect, it } from 'vitest'
import { generationInputIds } from './generation-inputs'

describe('generationInputIds', () => {
  it('reads the reference set', () => {
    expect(
      generationInputIds({ reference_image_ids: ['a', 'b', 'c'] }),
    ).toEqual(['a', 'b', 'c'])
  })

  // The regression this whole change exists for: an edit through a model's
  // image endpoint records `source_image_id` and no reference set, and
  // Activity's References block read only the set, so it rendered nothing on
  // a generation that plainly had an input.
  it('reads a lone source_image_id', () => {
    expect(generationInputIds({ source_image_id: 'src' })).toEqual(['src'])
  })

  it('de-duplicates the parent path, which writes the same id twice', () => {
    expect(
      generationInputIds({ source_image_id: 'p', parent_id: 'p' }),
    ).toEqual(['p'])
  })

  it('ignores parent_id, which is filing rather than input', () => {
    expect(generationInputIds({ parent_id: 'elsewhere' })).toEqual([])
  })

  it('ignores root_image_id, which is ancestry rather than input', () => {
    expect(generationInputIds({ root_image_id: 'root' })).toEqual([])
  })

  it('puts the source first, because that is the order the model saw', () => {
    // The panel holds one ordered set and the submit splits it at index 0 --
    // `sourceImageId` is the primary, `referenceImageIds` is the rest -- and
    // the server concatenates them back in that order before FAL sees them.
    // This returned `['r1','r2','src']` until #382, which put the image the
    // aspect ratio was derived from at the end of a list meaning "what went
    // in, in order". Harmless for a display strip; not harmless once a reader
    // loads the set back into the panel, where index 0 is load-bearing.
    expect(
      generationInputIds({
        reference_image_ids: ['r1', 'r2'],
        source_image_id: 'src',
      }),
    ).toEqual(['src', 'r1', 'r2'])
  })

  it('does not repeat a source already in the reference set', () => {
    expect(
      generationInputIds({
        reference_image_ids: ['a', 'b'],
        source_image_id: 'a',
      }),
    ).toEqual(['a', 'b'])
  })

  // Every row predating the lineage fields, which is most of the library.
  it('returns nothing for metadata with no inputs', () => {
    expect(generationInputIds({ prompt: 'a cat' })).toEqual([])
  })

  it('survives junk', () => {
    expect(generationInputIds(null)).toEqual([])
    expect(generationInputIds(undefined)).toEqual([])
    expect(generationInputIds('nope')).toEqual([])
    expect(generationInputIds({ reference_image_ids: 'not-an-array' })).toEqual(
      [],
    )
    expect(
      generationInputIds({ reference_image_ids: [1, null, 'ok'] }),
    ).toEqual(['ok'])
    expect(generationInputIds({ source_image_id: '' })).toEqual([])
  })
})
