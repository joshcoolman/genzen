import { describe, expect, it } from 'vitest'
import { referenceSheetFileName } from './reference-sheet.server'
import type { ReferenceSheet } from './reference-sheet.server'

function sheet(over: Partial<ReferenceSheet> = {}): ReferenceSheet {
  return {
    png: Buffer.alloc(0),
    cells: 11,
    width: 2048,
    height: 1815,
    rows: 4,
    cellHeight: 511,
    fill: 1,
    groupName: null,
    ...over,
  }
}

describe('referenceSheetFileName', () => {
  it('names the sheet after the group it came from', () => {
    expect(referenceSheetFileName(sheet({ groupName: 'Select One' }))).toBe(
      'select-one-11imgs.png',
    )
  })

  it('falls back outside a group', () => {
    expect(referenceSheetFileName(sheet())).toBe('reference-sheet-11imgs.png')
  })

  it('carries the count, which is what two runs are compared on', () => {
    expect(
      referenceSheetFileName(sheet({ groupName: 'Select One', cells: 6 })),
    ).toBe('select-one-6imgs.png')
  })

  it('slugs anything the OS would read as structure', () => {
    expect(referenceSheetFileName(sheet({ groupName: 'Ada/Rae "2026"' }))).toBe(
      'ada-rae-2026-11imgs.png',
    )
  })

  it('still produces a name when the group name slugs to nothing', () => {
    expect(referenceSheetFileName(sheet({ groupName: '...' }))).toBe(
      'reference-sheet-11imgs.png',
    )
  })
})
