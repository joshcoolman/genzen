import { describe, expect, it } from 'vitest'
import { displayPrompt } from './display-prompt'
import type { SavedAiImage } from './types'
import type { PreparedImageSkill } from './skills/types'

type Metadata = SavedAiImage['generation_metadata']

const shot = (number: number, description: string) => ({
  number,
  description,
  referenceImages: [],
})

const skill = {
  id: 'storyboard',
  shotNumber: 2,
  plan: {
    continuity: 'one bottle, one studio',
    held: 'the bottle',
    varies: 'the treatment',
    ordered: false,
    references: [],
    shots: [
      shot(1, 'Bottle on black, hard key.'),
      shot(2, 'Bottle in a splash.'),
    ],
    shotAspectRatio: '9:16',
  },
} as unknown as PreparedImageSkill

const meta = (extra: Partial<NonNullable<Metadata>>): Metadata =>
  ({
    prompt: '/storyboard I need a bunch of shots',
    model: 'x',
    ...extra,
  }) as NonNullable<Metadata>

describe('the prompt a generation shows', () => {
  it('shows an ordinary generation what was typed', () =>
    expect(displayPrompt(meta({ prompt: 'a red bottle' }))).toBe(
      'a red bottle',
    ))

  // The bug: ten shots of one brief all captioned themselves with the brief,
  // so the captions could not tell ten different pictures apart.
  it('shows a storyboard shot its own description, not the brief', () =>
    expect(displayPrompt(meta({ image_skill: skill }))).toBe(
      'Bottle in a splash.',
    ))

  it('falls back to the typed brief when the plan has no matching shot', () =>
    expect(
      displayPrompt(
        meta({
          image_skill: { ...skill, shotNumber: 9 } as PreparedImageSkill,
        }),
      ),
    ).toBe('/storyboard I need a bunch of shots'))

  it('reads the shot number off the row when the skill carries none', () =>
    expect(
      displayPrompt(
        meta({
          storyboard_shot: 1,
          image_skill: {
            ...skill,
            shotNumber: undefined,
          } as PreparedImageSkill,
        }),
      ),
    ).toBe('Bottle on black, hard key.'))

  it('has nothing to show for a row with no metadata', () =>
    expect(displayPrompt(null)).toBeUndefined())
})
