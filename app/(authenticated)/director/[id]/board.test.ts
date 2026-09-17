import { describe, expect, it } from 'vitest'
import {
  assembleScenes,
  boardVideoCostCents,
  closingReferenceIds,
  sceneReferenceIds,
  scenesToClose,
  sectionDuration,
} from './board'
import type { BoardSheet } from './board'
import type { ScriptLine } from './script'
import type { BoardScene } from '../_lib/types'

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

function line(number: number, seconds: number | null = 3): ScriptLine {
  return {
    clipId: id(number),
    number,
    line: `Line ${number}`,
    spoken: true,
    seconds,
  }
}

const characters: Array<BoardSheet> = [
  { id: id(1), title: 'The bear', description: null },
]
const locations: Array<BoardSheet> = [
  { id: id(2), title: 'The clearing', description: null },
  { id: id(3), title: 'The river', description: null },
]

function plan(scenes: Array<Record<string, unknown>>) {
  return { scenes } as Parameters<typeof assembleScenes>[0]['plan']
}

describe('assembleScenes', () => {
  const lines = [line(1), line(2, 12), line(3)]
  let next = 0
  const newId = () => id(((next += 1) % 9) + 1)

  it('is one scene per numbered line, carrying the script own numbers', () => {
    const scenes = assembleScenes({
      plan: plan([
        {
          line: 1,
          location: 2,
          characters: [1],
          opening: 'He arrives.',
          closing: 'He sits.',
        },
        {
          line: 2,
          location: 2,
          characters: [1],
          opening: 'He stands.',
          closing: 'He crosses the room.',
        },
        {
          line: 3,
          location: 1,
          characters: [1],
          opening: 'Outside.',
          closing: 'Walking away.',
        },
      ]),
      lines,
      characters,
      locations,
      newId,
    })
    expect(scenes.map((s) => s.number)).toEqual([1, 2, 3])
    expect(scenes.map((s) => s.line)).toEqual(['Line 1', 'Line 2', 'Line 3'])
    // The seconds are the clip's own, and the size of the change between the
    // two frames -- never summed across lines.
    expect(scenes.map((s) => s.seconds)).toEqual([3, 12, 3])
    expect(scenes[0].locationId).toBe(id(3))
    expect(scenes[0].characterIds).toEqual([id(1)])
    expect(scenes[0].openingId).toBeNull()
  })

  it('answers out of order still land in script order', () => {
    const scenes = assembleScenes({
      plan: plan([
        { line: 3, location: null, characters: [], opening: 'c', closing: 'c' },
        { line: 1, location: null, characters: [], opening: 'a', closing: 'a' },
        { line: 2, location: null, characters: [], opening: 'b', closing: 'b' },
      ]),
      lines,
      characters,
      locations,
      newId,
    })
    expect(scenes.map((s) => s.openingPrompt)).toEqual(['a', 'b', 'c'])
  })

  it('drops numbers it was never given, and never renumbers what is left', () => {
    const scenes = assembleScenes({
      plan: plan([
        { line: 1, location: 9, characters: [9], opening: 'a', closing: 'b' },
        // A line that is not in the script cannot be a scene of it.
        { line: 99, location: 1, characters: [1], opening: 'a', closing: 'b' },
        { line: 3, location: 1, characters: [1], opening: 'a', closing: 'b' },
      ]),
      lines,
      characters,
      locations,
      newId,
    })
    // Line 2 went unanswered, so it has no frames to draw -- and 3 stays 3,
    // because the number is its position in the run.
    expect(scenes.map((s) => s.number)).toEqual([1, 3])
    // A sheet number outside the list is no sheet, never someone else's row.
    expect(scenes[0].locationId).toBeNull()
    expect(scenes[0].characterIds).toEqual([])
  })
})

function scene(over: Partial<BoardScene> = {}): BoardScene {
  return {
    id: id(1),
    number: 1,
    line: 'Line 1',
    seconds: 3,
    characterIds: [id(2)],
    locationId: id(3),
    openingPrompt: 'a',
    closingPrompt: 'b',
    guidance: null,
    model: null,
    openingId: null,
    closingId: null,
    videoIds: [],
    ...over,
  }
}

describe('scenesToClose', () => {
  it('waits for the opening frame, because the closing one is made from it', () => {
    const pending = scene({ openingId: id(4) })
    expect(scenesToClose([pending], { [id(4)]: 'pending' })).toEqual([])
    expect(scenesToClose([pending], { [id(4)]: 'completed' })).toEqual([
      pending,
    ])
  })

  it('leaves a failed opening alone, and a closed scene alone', () => {
    expect(
      scenesToClose([scene({ openingId: id(4) })], { [id(4)]: 'failed' }),
    ).toEqual([])
    expect(
      scenesToClose([scene({ openingId: id(4), closingId: id(5) })], {
        [id(4)]: 'completed',
      }),
    ).toEqual([])
  })
})

describe('sceneReferenceIds', () => {
  it('puts the place first, and caps what one frame is generated from', () => {
    expect(sceneReferenceIds(scene())).toEqual([id(3), id(2)])
    expect(
      sceneReferenceIds(
        scene({ characterIds: [id(1), id(2), id(4), id(5), id(6)] }),
      ),
    ).toHaveLength(4)
  })

  it('sends the sheets with the closing frame too, behind the opening one', () => {
    // Every frame of every scene sees the character and the location: without
    // them the closing frame inherits its identity from a copy of a copy.
    expect(closingReferenceIds(scene(), id(9))).toEqual([id(9), id(3), id(2)])
  })
})

describe('sectionDuration', () => {
  it('submits the line own seconds, clamped to what the endpoint names', () => {
    // Every duration a script line carries is one Kling O3 Pro offers, so the
    // common case is the number unchanged.
    expect(sectionDuration(5)).toBe(5)
    expect(sectionDuration(12)).toBe(12)
    // Outside the range, the nearest offered rather than a refusal: the clip
    // still has to be generated.
    expect(sectionDuration(2)).toBe(3)
    expect(sectionDuration(40)).toBe(15)
  })

  it('falls back to the model default rather than guessing', () => {
    expect(sectionDuration(null)).toBe(8)
  })
})

describe('boardVideoCostCents', () => {
  it('counts every take, because the button is on every row', () => {
    // 14c/s: a 5s row is 70c, and two takes of it are $1.40.
    expect(boardVideoCostCents([scene({ seconds: 5, videoIds: [] })])).toBe(0)
    expect(
      boardVideoCostCents([
        scene({ seconds: 5, videoIds: [id(1), id(2)] }),
        scene({ seconds: 10, videoIds: [id(3)] }),
      ]),
    ).toBe(70 * 2 + 140)
  })
})
