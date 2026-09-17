import { describe, expect, it } from 'vitest'
import { dialogueOf, dialogueText, scriptOf } from './script'
import { composeClipPrompt } from '#/lib/server/director-chat.server'

describe('scriptOf', () => {
  it('joins the prompts verbatim with a blank line, keeping an upload as an empty entry', () => {
    expect(
      scriptOf([
        { description: "waves, 'hi everyone', looks down" },
        { description: null },
        { description: '  she picks up the phone  ' },
      ]),
    ).toBe("waves, 'hi everyone', looks down\n\n\n\nshe picks up the phone")
  })
})

describe('dialogueOf', () => {
  /* The guard that matters. `composeClipPrompt` is what builds these prompts,
     so the extraction is checked against its real output rather than against a
     hand-written string that could drift from it -- if the composition ever
     stops ending with the quoted line, this fails here instead of quietly
     producing an empty script. */
  it('takes the line back out of a prompt composeClipPrompt built', () => {
    const prompt = composeClipPrompt(
      'A round, fuzzy young bear cub with big amber eyes.',
      'He sits cross-legged on a giant mossy log in a sunlit forest clearing.',
      'Taps his temple with a stubby claw, grinning.',
      'I think school stops being about memorizing stuff.',
    )
    expect(dialogueOf([{ id: 'a', description: prompt }])).toEqual([
      {
        clipId: 'a',
        number: 1,
        line: 'I think school stops being about memorizing stuff.',
        spoken: true,
      },
    ])
  })

  /* Every clip made before #688 carries the shorter marker. */
  it('reads a clip written before the prompt said "in English"', () => {
    const [line] = dialogueOf([
      {
        id: 'a',
        description:
          'Vertical 9:16 video. A bear cub. A forest. Waves a paw. Speaking to camera: "That\'s still our job."',
      },
    ])
    expect(line.line).toBe("That's still our job.")
    expect(line.spoken).toBe(true)
  })

  /* A run's prompt is typed by hand and has no line to find. It keeps its
     place and its number rather than vanishing -- the clip is still in the
     run, and a script that silently renumbers around it lies about the cut. */
  it('keeps an unparseable clip in the list, numbered, marked unspoken', () => {
    const lines = dialogueOf([
      { id: 'a', description: 'she picks up the phone, wide shot' },
      { id: 'b', description: 'A bear. Speaking to camera: "Hello."' },
    ])
    expect(lines.map((l) => [l.number, l.spoken])).toEqual([
      [1, false],
      [2, true],
    ])
    expect(dialogueText(lines)).toBe('1. (no dialogue)\n\n2. Hello.')
  })

  /* The numbering follows the run, so removing a burst renumbers everything
     after it -- the script says what the film says, not what was written. */
  it('numbers by position in the run', () => {
    expect(
      dialogueOf([
        { id: 'a', description: 'x. Speaking to camera: "One."' },
        { id: 'b', description: 'x. Speaking to camera: "Two."' },
      ]).map((l) => `${l.number}:${l.line}`),
    ).toEqual(['1:One.', '2:Two.'])
  })
})
