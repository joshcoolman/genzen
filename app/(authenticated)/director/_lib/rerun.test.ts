import { describe, expect, it } from 'vitest'
import { composeShotPrompt, shotDuration } from './rerun'

const DURATIONS = [5, 6, 8, 10, 12, 15]
const shot = (spoken: string, speaker = 'the genie') => ({
  scene: 1,
  action: 'Medium shot of the genie facing the man.',
  speaker,
  spoken,
})

describe('new cut from script (#744)', () => {
  /* A line is timed from its words, never by the model (#685); a silent beat
     is the shortest clip, because the film should cut often. */
  it('times a line from its words and a silent beat short', () => {
    expect(shotDuration(shot(''), DURATIONS)).toBe(5)
    expect(shotDuration(shot('What is your wish?'), DURATIONS)).toBe(5)
    const long = Array.from({ length: 25 }, () => 'word').join(' ')
    expect(shotDuration(shot(long), DURATIONS)).toBe(10)
  })

  /* The anchors lead and the line is quoted with its speaker, so a shot with
     words is never generated as a silent one. */
  it('composes cast, scene, action, then the quoted line', () => {
    const prompt = composeShotPrompt(
      'Photographic. the genie: blue skin.',
      'A dark room.',
      shot('"Are you crazy?"'),
    )
    expect(prompt).toBe(
      'Photographic. the genie: blue skin. A dark room. Medium shot of the genie facing the man. the genie says, in English: "Are you crazy?"',
    )
    expect(composeShotPrompt('Cast.', 'Room.', shot(''))).not.toContain('says')
  })
})
