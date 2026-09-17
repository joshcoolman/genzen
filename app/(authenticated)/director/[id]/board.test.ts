import { describe, expect, it } from 'vitest'
import { boardImageIds, parseBoard } from '../_lib/types'
import {
  assembleScenes,
  boardVideoCostCents,
  closingReferenceIds,
  lineToSpeak,
  sceneReferenceIds,
  scenesToClose,
  sectionCostCents,
  sectionDuration,
  sectionImages,
  sectionPinsOpening,
  sectionTakesEndFrame,
  spokenOf,
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
          spoken: null,
        },
        {
          line: 2,
          location: 2,
          characters: [1],
          opening: 'He stands.',
          closing: 'He crosses the room.',
          spoken: null,
        },
        {
          line: 3,
          location: 1,
          characters: [1],
          opening: 'Outside.',
          closing: 'Walking away.',
          spoken: null,
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
        {
          line: 3,
          location: null,
          characters: [],
          opening: 'c',
          closing: 'c',
          spoken: null,
        },
        {
          line: 1,
          location: null,
          characters: [],
          opening: 'a',
          closing: 'a',
          spoken: null,
        },
        {
          line: 2,
          location: null,
          characters: [],
          opening: 'b',
          closing: 'b',
          spoken: null,
        },
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
        {
          line: 1,
          location: 9,
          characters: [9],
          opening: 'a',
          closing: 'b',
          spoken: null,
        },
        // A line that is not in the script cannot be a scene of it.
        {
          line: 99,
          location: 1,
          characters: [1],
          opening: 'a',
          closing: 'b',
          spoken: null,
        },
        {
          line: 3,
          location: 1,
          characters: [1],
          opening: 'a',
          closing: 'b',
          spoken: null,
        },
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
    spokenLine: null,
    seconds: 3,
    characterIds: [id(2)],
    locationId: id(3),
    openingPrompt: 'a',
    closingPrompt: 'b',
    guidance: null,
    model: null,
    openingId: null,
    closingId: null,
    takes: [],
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
    expect(boardVideoCostCents([scene({ seconds: 5, takes: [] })])).toBe(0)
    expect(
      boardVideoCostCents([
        scene({
          seconds: 5,
          takes: [
            { id: id(1), number: 1, model: null },
            { id: id(2), number: 2, model: null },
          ],
        }),
        scene({ seconds: 10, takes: [{ id: id(3), number: 1, model: null }] }),
      ]),
    ).toBe(70 * 2 + 140)
  })
})

describe('boardImageIds', () => {
  it('carries the takes as well as the frames', () => {
    /* The regression this exists for: `listBoardFrames` kept its own copy of
       "every row the board owns", the copy was never updated when takes were
       added, and because `frameState` reads an id it cannot find as still
       being made, a finished take and a missing one looked identical on
       screen -- "working", for ever. One definition, and a test on it. */
    const board = {
      version: 1 as const,
      model: 'kling-o3-pro',
      scenes: [
        scene({
          openingId: id(1),
          closingId: id(2),
          takes: [
            { id: id(3), number: 1, model: null },
            { id: id(4), number: 2, model: null },
          ],
        }),
        scene({ openingId: id(5), closingId: null, takes: [] }),
      ],
    }
    expect(boardImageIds(board)).toEqual([id(1), id(2), id(3), id(4), id(5)])
  })
})

describe('spokenOf and lineToSpeak', () => {
  it('keeps null when the respelling adds nothing', () => {
    // Null for a line with nothing hard in it, and null for a respelling that
    // came back identical -- the row should not carry a second copy of the
    // line, and there is nothing to keep in step.
    expect(spokenOf(null, 'Plain words.')).toBeNull()
    expect(spokenOf('Plain words.', 'Plain words.')).toBeNull()
    expect(spokenOf('  ', 'Plain words.')).toBeNull()
  })

  it('is what the model is told to say, while the line stays the record', () => {
    const said = 'day-KART asked the same question.'
    const s = scene({ line: 'Descartes asked the same question.' })
    expect(lineToSpeak(s)).toBe('Descartes asked the same question.')
    expect(lineToSpeak({ ...s, spokenLine: said })).toBe(said)
    // The record is untouched by the respelling -- the Script tab reads it.
    expect({ ...s, spokenLine: said }.line).toBe(
      'Descartes asked the same question.',
    )
  })
})

describe('a take keeps its number', () => {
  it('reads a board written before takes carried one', () => {
    // The number was the position then, so reading it as such loses nothing --
    // those were the numbers that had been on screen.
    const parsed = parseBoard({
      version: 1,
      scenes: [
        {
          ...scene(),
          takes: undefined,
          videoIds: [id(1), id(2)],
        },
      ],
    })
    expect(parsed.scenes[0].takes).toEqual([
      { id: id(1), number: 1, model: null },
      { id: id(2), number: 2, model: null },
    ])
  })

  it('survives its neighbours being deleted', () => {
    /* The bug: the number was `index + 1`, so deleting take 2 renamed take 3
       to take 2 -- a thing you had watched and formed an opinion about,
       renamed because something else was thrown away. */
    const takes = [
      { id: id(1), number: 1, model: null },
      { id: id(2), number: 2, model: null },
      { id: id(3), number: 3, model: null },
    ]
    const left = takes.filter((t) => t.id !== id(2))
    expect(left.map((t) => t.number)).toEqual([1, 3])
    // And the next one issued is 4, never a number that has been used.
    const next = left.reduce((high, t) => Math.max(high, t.number), 0) + 1
    expect(next).toBe(4)
  })
})

describe('choosing the section model (#702)', () => {
  const KLING = 'kling-o3-pro'
  const SEEDANCE = 'seedance-2.5'

  it('pins the opening frame on Kling and references it on Seedance', () => {
    /* Seedance's reference endpoint has no start-image parameter, and
       `imageCompatibility` refuses references and frames together -- so the
       opening frame goes in as a reference, leading the list, and the clip
       does not begin on it. */
    const s = scene({ openingId: id(9), closingId: id(8) })
    expect(sectionImages(s, KLING, id(8))).toEqual([
      { id: id(9), role: 'first' },
      { id: id(3), role: 'reference' },
      { id: id(2), role: 'reference' },
      { id: id(8), role: 'last' },
    ])
    expect(sectionImages(s, SEEDANCE, id(8))).toEqual([
      { id: id(9), role: 'reference' },
      { id: id(3), role: 'reference' },
      { id: id(2), role: 'reference' },
    ])
  })

  it('knows which model takes an end frame at all', () => {
    expect(sectionTakesEndFrame(KLING)).toBe(true)
    expect(sectionTakesEndFrame(SEEDANCE)).toBe(false)
    expect(sectionPinsOpening(KLING)).toBe(true)
    expect(sectionPinsOpening(SEEDANCE)).toBe(false)
  })

  it('prices a take by the model that made it', () => {
    // 14c/s against 47.3c/s: a board holding both cannot be summed at one rate.
    const mixed = [
      scene({
        seconds: 5,
        takes: [
          { id: id(1), number: 1, model: KLING },
          { id: id(2), number: 2, model: SEEDANCE },
        ],
      }),
    ]
    expect(boardVideoCostCents(mixed)).toBe(
      sectionCostCents(5, KLING) + sectionCostCents(5, SEEDANCE),
    )
    expect(sectionCostCents(5, SEEDANCE)).toBeGreaterThan(
      sectionCostCents(5, KLING),
    )
  })
})
