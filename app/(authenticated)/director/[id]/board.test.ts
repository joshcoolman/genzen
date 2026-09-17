import { describe, expect, it } from 'vitest'
import { assembleScenes, sceneReferenceIds, scenesToClose } from './board'
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
  const lines = [line(1), line(2), line(3)]
  let next = 0
  const newId = () => id(((next += 1) % 9) + 1)

  it('maps line and sheet numbers back onto the session own rows', () => {
    const [scene] = assembleScenes({
      plan: plan([
        {
          title: 'At the river',
          lines: [1, 2],
          location: 2,
          characters: [1],
          opening: 'He arrives.',
          closing: 'He leaves.',
        },
      ]),
      lines,
      characters,
      locations,
      newId,
    })
    expect(scene.lines).toEqual(['Line 1', 'Line 2'])
    expect(scene.locationId).toBe(id(3))
    expect(scene.characterIds).toEqual([id(1)])
    // Summed from the clips, which is a measurement of what the film ran to.
    expect(scene.seconds).toBe(6)
    expect(scene.openingId).toBeNull()
  })

  it('drops numbers it was never given, and renumbers what is left', () => {
    // The second scene names only lines that do not exist, so it cannot be
    // drawn and must not leave a gap in the numbering behind it.
    const scenes = assembleScenes({
      plan: plan([
        {
          title: 'One',
          lines: [1],
          location: 1,
          characters: [1],
          opening: 'a',
          closing: 'b',
        },
        {
          title: 'Nothing',
          lines: [99],
          location: 9,
          characters: [9],
          opening: 'a',
          closing: 'b',
        },
        {
          title: 'Three',
          lines: [2, 3],
          location: 9,
          characters: [9],
          opening: 'a',
          closing: 'b',
        },
      ]),
      lines,
      characters,
      locations,
      newId,
    })
    expect(scenes.map((s) => s.number)).toEqual([1, 2])
    expect(scenes.map((s) => s.title)).toEqual(['One', 'Three'])
    // A location number outside the list is no location, never someone else's
    // row.
    expect(scenes[1].locationId).toBeNull()
    expect(scenes[1].characterIds).toEqual([])
  })
})

function scene(over: Partial<BoardScene> = {}): BoardScene {
  return {
    id: id(1),
    number: 1,
    title: 'A scene',
    lines: ['Line 1'],
    seconds: 3,
    characterIds: [id(2)],
    locationId: id(3),
    openingPrompt: 'a',
    closingPrompt: 'b',
    guidance: null,
    openingId: null,
    closingId: null,
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
})
