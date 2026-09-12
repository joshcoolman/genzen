import { describe, expect, it } from 'vitest'
import {
  REF_ROLES,
  isReadRole,
  promptWithReadings,
  readingBlocks,
} from './ref-roles'

const lighting = {
  imageId: 'a',
  role: 'lighting' as const,
  text: 'One hard source high left.',
}
const style = {
  imageId: 'b',
  role: 'style' as const,
  text: 'Cut paper, matte, limited palette.',
}

describe('reference roles (#635)', () => {
  it('sends only the first role and reads every other', () => {
    expect(REF_ROLES[0].id).toBe('reference')
    expect(isReadRole('reference')).toBe(false)
    expect(isReadRole(undefined)).toBe(false)
    for (const role of REF_ROLES.slice(1))
      expect(isReadRole(role.id)).toBe(true)
  })

  it('writes one labelled block per reading, in the order given', () => {
    expect(readingBlocks([lighting, style])).toBe(
      'Lighting:\nOne hard source high left.\n\nStyle:\nCut paper, matte, limited palette.',
    )
    expect(readingBlocks([])).toBe('')
  })

  it('puts the blocks under the typed words, and stands alone when nothing was typed', () => {
    // The empty case is the one that matters: a prompt made of blocks alone is
    // non-empty, so the server's image-only describe fallback never runs and
    // a description of the sent picture is never stacked above them.
    expect(promptWithReadings('a fox, three-quarter view', [style])).toBe(
      'a fox, three-quarter view\n\nStyle:\nCut paper, matte, limited palette.',
    )
    expect(promptWithReadings('', [style])).toBe(
      'Style:\nCut paper, matte, limited palette.',
    )
    expect(promptWithReadings('a fox', [])).toBe('a fox')
  })
})
