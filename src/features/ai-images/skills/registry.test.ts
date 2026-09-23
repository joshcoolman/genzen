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
      shots: null,
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
  // Nothing about a count refuses a brief. A paragraph of scene description
  // used to be rejected outright over one token in it -- "maybe ten shots" is
  // a passing thought, not an instruction, and it threw away the prompt.
  it.each([
    ['--shots 10 chase', 9],
    ['--shots 99 chase', 9],
    ['12 panels of a chase', 9],
    ['ten shots of three men running', 9],
    ['--shots 0 chase', 2],
    ['--shots 1 chase', 2],
  ])('clamps an out-of-range count %j to %i', (brief, expected) =>
    expect(storyboardShotCount(brief)).toBe(expected),
  )
  it.each([
    '--shots 2.5 chase',
    '--shots nope chase',
    'chase --shots',
    'chase --shots=',
  ])('leaves an unreadable count to the plan %j', (brief) =>
    expect(storyboardShotCount(brief)).toBeNull(),
  )
  it('does not confuse subjects with shot counts', () =>
    expect(
      storyboardShotCount('Two characters fight, image 3 is the environment'),
    ).toBeNull())
  // Null is not "six" (#714). A brief that pins nothing leaves the count to
  // the plan, and the difference is load-bearing: six was a default nobody
  // chose, applied to briefs that wanted three images or nine.
  it.each(['A chase', 'five characters for a game', 'some watch angles'])(
    'leaves an unpinned count to the plan %j',
    (brief) => expect(storyboardShotCount(brief)).toBeNull(),
  )
})

it('counts storyboard outputs, plain prompts and incomplete commands for the composer', () => {
  expect(promptImageCount('/storyboard A chase')).toBe(6)
  expect(promptImageCount('/storyboard --shots 4 A chase')).toBe(4)
  expect(promptImageCount('/storyboard')).toBe(6)
  expect(promptImageCount('A portrait')).toBe(1)
  expect(promptImageCount('')).toBe(0)
  // 9, not 0. A clamp the composer can see beats "this will generate
  // nothing" about a prompt that was about to be rejected.
  expect(promptImageCount('/storyboard --shots 99 A chase')).toBe(9)
})
