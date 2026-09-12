import { describe, expect, it } from 'vitest'
import {
  formatTime,
  nearestAspect,
  parseShots,
  scriptProblem,
  scriptText,
} from './final-script'

const good = `integrated_multimodal_description:
[Shot 1] [00:00.000 - 00:03.500] WIDE ESTABLISHING SHOT, slow forward dolly. A paper dojo.
[Shot 2] [00:03.500 - 00:07.000] HARD CUT TO MEDIUM TWO-SHOT. The fox draws.
[Shot 3] [00:07.000 - 00:10.000] HARD CUT TO CLOSE TWO-SHOT. Stillness. No onscreen text.

overall_soundscape:
Paper flexing, a dry whisper of a blade.

non_diegetic_music:
A single plucked shamisen line.`

describe('final script sections (#634)', () => {
  it('reads every shot line with its timestamps', () => {
    expect(parseShots(good)).toEqual([
      { number: 1, start: 0, end: 3.5 },
      { number: 2, start: 3.5, end: 7 },
      { number: 3, start: 7, end: 10 },
    ])
  })

  it('accepts a section whose shots run contiguously to its duration', () => {
    expect(scriptProblem(good, 10)).toBeNull()
  })

  it('names the problem when the timing does not land', () => {
    // The writer's own instructions say the arithmetic is where it fails, by
    // a second long. The message is what goes back as the repair.
    expect(scriptProblem(good, 15)).toMatch(/must be 00:15\.000/)
    const gap = good.replace(
      '[00:03.500 - 00:07.000]',
      '[00:04.000 - 00:07.000]',
    )
    expect(scriptProblem(gap, 10)).toMatch(
      /Shot 2 must start where shot 1 ends/,
    )
    expect(scriptProblem('just prose', 5)).toMatch(/No shot lines/)
    const noMusic = good.replace('non_diegetic_music:', 'music:')
    expect(scriptProblem(noMusic, 10)).toMatch(/non_diegetic_music/)
  })

  it('formats seconds the way the shot lines are written', () => {
    expect(formatTime(10)).toBe('00:10.000')
    expect(formatTime(3.5)).toBe('00:03.500')
    expect(formatTime(75)).toBe('01:15.000')
  })

  it('picks the nearest H3 ratio for a frame, and wide when unknown', () => {
    expect(nearestAspect(1920, 1080)).toBe('16:9')
    expect(nearestAspect(1080, 1920)).toBe('9:16')
    expect(nearestAspect(1024, 1024)).toBe('1:1')
    expect(nearestAspect(0, 0)).toBe('16:9')
  })

  it('joins the whole script into one copyable text with section headers', () => {
    const text = scriptText({
      title: 'Paper Samurai',
      story: 'A fox and a cat.',
      continuity: 'Fox in rust.',
      style: 'Cut paper.',
      sections: [
        { index: 0, duration: 10, text: good },
        { index: 1, duration: 5, text: 'second' },
      ],
    })
    expect(text).toContain('--- Section 1 · 10s ---')
    expect(text).toContain('--- Section 2 · 5s ---')
    expect(text.indexOf('Continuity:')).toBeLessThan(text.indexOf('Section 1'))
  })
})
