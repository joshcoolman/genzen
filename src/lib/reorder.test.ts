import { describe, expect, it } from 'vitest'
import { moveTo } from './reorder'

/**
 * The rightwards move is the whole test. Dragging left is correct whether or
 * not the index is compensated for the removal, so a broken implementation
 * passes every leftwards case and fails silently in one direction.
 */
describe('moveTo', () => {
  const list = ['a', 'b', 'c', 'd', 'e']

  it('drops into the gap before a later card', () => {
    // "before d" is index 3 while the list still holds b.
    expect(moveTo(list, 'b', 3)).toEqual(['a', 'c', 'b', 'd', 'e'])
  })

  it('drops into the gap before an earlier card', () => {
    expect(moveTo(list, 'd', 1)).toEqual(['a', 'd', 'b', 'c', 'e'])
  })

  it('drops at the end', () => {
    expect(moveTo(list, 'a', 5)).toEqual(['b', 'c', 'd', 'e', 'a'])
  })

  it('drops at the front', () => {
    expect(moveTo(list, 'e', 0)).toEqual(['e', 'a', 'b', 'c', 'd'])
  })

  it('treats both gaps around an item as no move', () => {
    expect(moveTo(list, 'c', 2)).toEqual(list)
    expect(moveTo(list, 'c', 3)).toEqual(list)
  })

  it('leaves the list alone when the item is not in it', () => {
    expect(moveTo(list, 'z', 2)).toEqual(list)
  })
})
