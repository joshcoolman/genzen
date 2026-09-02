import { describe, expect, it } from 'vitest'
import { hiddenInScope, isVisible } from './use-visibility'
import type { SavedAiImage } from '#/features/ai-images/types'

function image(
  id: string,
  hidden: boolean,
  groupId: string | null = null,
): SavedAiImage {
  return {
    id,
    group_id: groupId,
    origin: 'images',
    title: 'FLUX.2 Pro',
    storage_path: `u/${id}.png`,
    created_at: '2026-08-27T00:00:00.000Z',
    status: 'completed',
    generation_error: null,
    generation_metadata: null,
    hidden_at: hidden ? '2026-08-27T00:00:00.000Z' : null,
  }
}

/**
 * The rule that decides whether a picture is on screen (#504). Worth testing
 * because both ways of getting it wrong are silent: images that will not come
 * back, or images that were never taken away.
 */
describe('isVisible', () => {
  it('draws everything when nothing is hidden or focused', () => {
    expect(isVisible(image('a', false), null)).toBe(true)
  })

  it('withholds a hidden image', () => {
    // There is no peek: the only way back is Show, which clears `hidden_at`
    // on every hidden row, so a hidden image is never drawn while it is one.
    expect(isVisible(image('a', true), null)).toBe(false)
  })

  it('lets focus override hidden rather than intersecting with it', () => {
    // A focus is a set the user named. Intersecting the two would drop images
    // they had just selected, leaving the strip's count disagreeing with the
    // grid -- and nothing on screen would say why.
    const focus = new Set(['a'])
    expect(isVisible(image('a', true), focus)).toBe(true)
    expect(isVisible(image('b', false), focus)).toBe(false)
  })
})

/**
 * What the bar says, and what `Show` acts on (#546).
 *
 * Both were the whole library while the wall was one group, which made the
 * count wrong in a visible way and `Show` wrong in a way that took an action:
 * pressing it from inside a group unhid every hidden image everywhere.
 */
describe('hiddenInScope', () => {
  const rows = [
    image('loose', true),
    image('in-a', true, 'a'),
    image('in-b', true, 'b'),
    image('visible-a', false, 'a'),
  ]

  it('counts only what is hidden at top level, not inside groups', () => {
    const ids = hiddenInScope(rows, (img) => !img.group_id).map((r) => r.id)
    expect(ids).toEqual(['loose'])
  })

  it('counts only the open group, not the library', () => {
    const ids = hiddenInScope(rows, (img) => img.group_id === 'a').map(
      (r) => r.id,
    )
    expect(ids).toEqual(['in-a'])
  })

  it('is newest first, so the tray undoes the last thing you did', () => {
    const older = { ...image('older', true), hidden_at: '2026-08-01T00:00:00Z' }
    const newer = { ...image('newer', true), hidden_at: '2026-08-28T00:00:00Z' }
    expect(hiddenInScope([older, newer], () => true).map((r) => r.id)).toEqual([
      'newer',
      'older',
    ])
  })
})
