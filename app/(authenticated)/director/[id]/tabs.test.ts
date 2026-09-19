import { describe, expect, it } from 'vitest'
import { visibleTab } from './tabs'

describe('visibleTab', () => {
  it('leaves an available tab alone', () => {
    const open = { script: true, storyboard: true }
    expect(visibleTab('storyboard', open)).toBe('storyboard')
    expect(visibleTab('script', open)).toBe('script')
    expect(visibleTab('characters', open)).toBe('characters')
    expect(visibleTab('work', open)).toBe('work')
  })

  /* The bug (#707). The last location sheet is deleted while the storyboard
     tab is the one open: its button stops rendering and the panel has to stop
     with it, or Create storyboard is a button that only throws. */
  it('falls back to Work when the storyboard loses an input under it', () => {
    expect(visibleTab('storyboard', { script: true, storyboard: false })).toBe(
      'work',
    )
  })

  it('falls back to Work when a chat loses its last clip under Script', () => {
    expect(visibleTab('script', { script: false, storyboard: false })).toBe(
      'work',
    )
  })

  /* A reference tab is offered whatever the session holds, so nothing here
     takes it away. */
  it('keeps a reference tab whatever the other two are', () => {
    expect(visibleTab('locations', { script: false, storyboard: false })).toBe(
      'locations',
    )
  })
})
