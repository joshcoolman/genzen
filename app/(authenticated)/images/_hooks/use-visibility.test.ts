import { describe, expect, it } from 'vitest'
import { isVisible } from './use-visibility'
import type { SavedAiImage } from '#/features/ai-images/types'

function image(id: string, hidden: boolean): SavedAiImage {
  return {
    id,
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
