import { describe, expect, it } from 'vitest'
import {
  clampAnswer,
  composeClipPrompt,
  nearestDuration,
} from './director-chat.server'

const durations = [5, 6, 8, 10, 12, 15]

describe('director chat answers (#670)', () => {
  it('brings a written duration to one the model offers', () => {
    expect(nearestDuration(durations, 7)).toBe(6)
    expect(nearestDuration(durations, 14)).toBe(15)
    expect(nearestDuration(durations, 40)).toBe(15)
    expect(nearestDuration(durations, 1)).toBe(5)
  })

  it('keeps at most six clips and refuses none', () => {
    const clip = { action: 'a', spoken: 's', duration: 4 }
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
