import { describe, expect, it } from 'vitest'
import {
  clampAnswer,
  composeClipPrompt,
  durationForWords,
} from './director-chat.server'

const durations = [5, 6, 8, 10, 12, 15]

describe('director chat answers (#670)', () => {
  it('times a burst to its words, never faster than speaking pace', () => {
    expect(durationForWords(4, durations)).toBe(5)
    expect(durationForWords(14, durations)).toBe(5)
    expect(durationForWords(17, durations)).toBe(8)
    expect(durationForWords(24, durations)).toBe(10)
    expect(durationForWords(27, durations)).toBe(10)
    // Past what any length can say cleanly: the longest, not an error.
    expect(durationForWords(80, durations)).toBe(15)
  })

  it('keeps at most six clips, times each, and refuses none', () => {
    const clip = { action: 'a', spoken: 'one two three four five six' }
    const seven = clampAnswer(
      {
        character: 'c',
        title: 't',
        scene: 'sc',
        line: 'l',
        clips: Array.from({ length: 7 }, () => clip),
      },
      durations,
    )
    expect(seven.clips).toHaveLength(6)
    expect(seven.clips[0].duration).toBe(5)
    expect(() =>
      clampAnswer(
        { character: 'c', title: 't', scene: 'sc', line: 'l', clips: [] },
        durations,
      ),
    ).toThrow('nothing to say')
  })

  it('prepends the anchors and appends the line to every burst', () => {
    expect(
      composeClipPrompt(
        ' Enzo, a fisherman. ',
        'On the dock.',
        'He waves.',
        '"Ciao."',
      ),
    ).toBe(
      'Vertical 9:16 video, the character facing the camera. Enzo, a fisherman. On the dock. He waves. Speaking to camera: "Ciao."',
    )
    expect(composeClipPrompt('Enzo.', '', 'He waves.', '')).toBe(
      'Vertical 9:16 video, the character facing the camera. Enzo. He waves.',
    )
  })
})
