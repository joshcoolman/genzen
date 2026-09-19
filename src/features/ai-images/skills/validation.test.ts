import { describe, expect, it } from 'vitest'
import {
  shotRatio,
  validateSkillReferences,
  validateStoryboardPlan,
} from './validation'

const plan = {
  continuity:
    'Two fighters keep their blue and red uniforms in the same courtyard.',
  held: 'the two fighters and the courtyard',
  varies: 'the moment of the fight',
  ordered: true,
  references: [
    { image: 1, role: 'Blue fighter' },
    { image: 2, role: 'Courtyard' },
  ],
  shotAspectRatio: '16:9',
  shots: [
    {
      number: 1,
      description: 'Wide: the blue fighter enters the courtyard.',
      referenceImages: [1, 2],
    },
    {
      number: 2,
      description: 'Medium: the blue fighter takes a stance.',
      referenceImages: [1, 2],
    },
  ],
}
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]

describe('storyboard contract', () => {
  it('preserves explicit roles and shot order', () =>
    expect(validateStoryboardPlan(plan, 2, 2)).toEqual(plan))
  it('rejects a missing, empty or oversized plan', () => {
    for (const value of [
      null,
      {},
      { ...plan, continuity: '' },
      { ...plan, shots: Array.from({ length: 10 }, () => plan.shots[0]) },
    ])
      expect(() => validateStoryboardPlan(value, 2)).toThrow('invalid plan')
  })
  it('enforces the requested count', () =>
    expect(() => validateStoryboardPlan(plan, 2, 6)).toThrow('instead of 6'))
  it('rejects reordered reference assignments', () =>
    expect(() =>
      validateStoryboardPlan(
        { ...plan, references: [...plan.references].reverse() },
        2,
      ),
    ).toThrow('numbered references'))
  it('rejects invalid shot ordinals and missing reference numbers', () => {
    expect(() =>
      validateStoryboardPlan({ ...plan, shots: [...plan.shots].reverse() }, 2),
    ).toThrow('shot order')
    expect(() =>
      validateStoryboardPlan(
        {
          ...plan,
          shots: [{ ...plan.shots[0], referenceImages: [3] }, plan.shots[1]],
        },
        2,
      ),
    ).toThrow('reference assignments')
  })
  it('allows planning without references', () =>
    expect(
      validateStoryboardPlan(
        {
          ...plan,
          references: [],
          shots: plan.shots.map((s) => ({ ...s, referenceImages: [] })),
        },
        0,
      ),
    ).toBeDefined())
  it('checks every model before a plan can use excess references', () => {
    expect(() =>
      validateSkillReferences(['openai/gpt-image-2.5/sunburst/edit'], ids),
    ).not.toThrow()
    expect(() =>
      validateSkillReferences(
        [
          'openai/gpt-image-2.5/sunburst/edit',
          'fal-ai/z-image/turbo/image-to-image',
        ],
        ids,
      ),
    ).toThrow('holds 1')
    expect(() =>
      validateSkillReferences(
        ['openai/gpt-image-2.5/sunburst/edit'],
        [ids[0], ids[0]],
      ),
    ).toThrow('distinct')
  })
})

describe('a set that is not all one shape', () => {
  // "Most of them square, make two vertical" is one plan with two answers in
  // it. Before #714's second pass there was one ratio field, so the model
  // wrote the majority answer and the exceptions rendered square anyway.
  it('lets a shot override the set with its own ratio', () => {
    const mixed = {
      ...plan,
      shotAspectRatio: '1:1',
      shots: [
        plan.shots[0],
        { ...plan.shots[1], aspectRatio: '9:16' as const },
      ],
    }
    const parsed = validateStoryboardPlan(mixed, 2)
    expect(shotRatio(parsed, parsed.shots[0])).toBe('1:1')
    expect(shotRatio(parsed, parsed.shots[1])).toBe('9:16')
  })

  it('reads an absent override as the set itself', () =>
    expect(shotRatio({ shotAspectRatio: '4:3' }, {})).toBe('4:3'))

  it('rejects a ratio the renderers have no vocabulary for', () =>
    expect(() =>
      validateStoryboardPlan(
        {
          ...plan,
          shots: [plan.shots[0], { ...plan.shots[1], aspectRatio: '7:13' }],
        },
        2,
      ),
    ).toThrow('invalid plan'))
})
