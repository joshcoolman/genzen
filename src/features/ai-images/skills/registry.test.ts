import { describe, expect, it } from 'vitest'
import {
  parsePromptInvocation,
  promptImageCount,
  storyboardShotCount,
} from './registry'

describe('image prompt commands', () => {
  it.each([
    'a /storyboard in a notebook',
    'https://example.com/a',
    'paint a cat',
    '',
  ])('keeps plain prompt %j unchanged', (input) => {
    expect(parsePromptInvocation(input)).toEqual({ kind: 'plain', text: input })
  })
  it.each([
    '/storyboardish a fight',
    '/storyboard:a fight',
    '/storyboard/a fight',
    '/unknown a fight',
    '/',
  ])('rejects unknown command token %j', (input) => {
    expect(() => parsePromptInvocation(input)).toThrow('Unknown image command')
  })
  it.each(['/storyboard', '/storyboard   ', '/storyboard --shots 4'])(
    'rejects empty brief %j',
    (input) => {
      expect(() => parsePromptInvocation(input)).toThrow('Add a scene idea')
    },
  )
  it('recognizes a pasted leading command and keeps its original input', () => {
    const originalInput = '  /storyboard\nA car chase.  '
    expect(parsePromptInvocation(originalInput)).toEqual({
      kind: 'skill',
      skillId: 'storyboard',
      originalInput,
      brief: 'A car chase.',
      shots: 6,
    })
  })
  it.each([
    'four shots of a chase',
    'a four-shot chase',
    '--shots 4 A chase',
    '--shots=4 A chase',
  ])('accepts four-shot direction %j', (brief) =>
    expect(storyboardShotCount(brief)).toBe(4),
  )
  it.each([
    '--shots 0 chase',
    '--shots 10 chase',
    '--shots 2.5 chase',
    '--shots nope chase',
    'chase --shots',
    'chase --shots=',
    '12 panels of a chase',
  ])('rejects invalid counts %j', (brief) =>
    expect(() => storyboardShotCount(brief)).toThrow('2–9'),
  )
  it('does not confuse subjects with shot counts', () =>
    expect(
      storyboardShotCount('Two characters fight, image 3 is the environment'),
    ).toBe(6))
})

it('counts storyboard outputs, plain prompts and incomplete commands for the composer', () => {
  expect(promptImageCount('/storyboard A chase')).toBe(6)
  expect(promptImageCount('/storyboard --shots 4 A chase')).toBe(4)
  expect(promptImageCount('/storyboard')).toBe(6)
  expect(promptImageCount('A portrait')).toBe(1)
  expect(promptImageCount('')).toBe(0)
  expect(promptImageCount('/storyboard --shots 99 A chase')).toBe(0)
})
