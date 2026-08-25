import { describe, expect, it } from 'vitest'
import { countedBaseName } from './download-name'

describe('countedBaseName', () => {
  it('names the file after the group it came from', () => {
    expect(countedBaseName('Select One', 6, 'selection')).toBe(
      'select-one-6imgs',
    )
  })

  it('falls back outside a group', () => {
    expect(countedBaseName(null, 6, 'selection')).toBe('selection-6imgs')
  })

  it('slugs anything the OS would read as structure', () => {
    expect(countedBaseName('Ada/Rae "2026"', 2, 'selection')).toBe(
      'ada-rae-2026-2imgs',
    )
  })

  it('still produces a name when the group name slugs to nothing', () => {
    expect(countedBaseName('...', 2, 'selection')).toBe('selection-2imgs')
  })
})
