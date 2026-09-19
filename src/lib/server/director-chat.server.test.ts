import { describe, expect, it } from 'vitest'
import {
  clampAnswer,
  composeClipPrompt,
  countWords,
  durationForWords,
  spokenFromClipPrompt,
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
    // A quick talker fits more into the same clip; there is no slow.
    expect(durationForWords(16, durations)).toBe(6)
    expect(durationForWords(16, durations, 'quick')).toBe(5)
  })

  it('keeps at most six clips, times each, and refuses none', () => {
    const clip = { action: 'a', spoken: 'one two three four five six' }
    const seven = clampAnswer(
      {
        character: 'c',
        title: 't',
        scene: 'sc',
        line: 'l',
        pace: 'normal' as const,
        clips: Array.from({ length: 7 }, () => clip),
      },
      durations,
    )
    expect(seven.clips).toHaveLength(6)
    expect(seven.clips[0].duration).toBe(5)
    expect(() =>
      clampAnswer(
        {
          character: 'c',
          title: 't',
          scene: 'sc',
          line: 'l',
          pace: 'normal' as const,
          clips: [],
        },
        durations,
      ),
    ).toThrow('nothing to say')
  })

  /* Rerun has only the stored prompt to time against (#692) -- the turn keeps
     the whole answer's line, not each burst's -- so reading the line back out
     of the prompt is what stands between a re-roll and the old row's seconds. */
  it('reads a burst line back out of the prompt it was composed into', () => {
    const prompt = composeClipPrompt(
      'Enzo, a fisherman.',
      'On the dock.',
      'He waves.',
      '"Ciao, come stai oggi?"',
    )
    expect(spokenFromClipPrompt(prompt)).toBe('Ciao, come stai oggi?')
    expect(countWords(spokenFromClipPrompt(prompt))).toBe(4)
    // A silent burst: nothing to time against, and nothing invented.
    expect(
      spokenFromClipPrompt(composeClipPrompt('Enzo.', '', 'He waves.', '')),
    ).toBe('')
    // A prompt from before the anchors were prepended in code.
    expect(spokenFromClipPrompt('Some older prompt shape.')).toBe('')
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
      'Vertical 9:16 video, the character facing the camera and speaking English. Enzo, a fisherman. On the dock. He waves. Speaking to camera, in English: "Ciao."',
    )
    expect(composeClipPrompt('Enzo.', '', 'He waves.', '')).toBe(
      'Vertical 9:16 video, the character facing the camera and speaking English. Enzo. He waves.',
    )
  })
})
