import { describe, expect, it } from 'vitest'
import { spokenFromClipPrompt } from './director-clip-prompt'
import { composeClipPrompt } from '#/lib/server/director-chat.server'

describe('reading a chat clip line back out of its prompt', () => {
  it('reads what composeClipPrompt wrote', () => {
    expect(
      spokenFromClipPrompt(
        composeClipPrompt(
          'Enzo, a fisherman.',
          'On the dock.',
          'He waves.',
          '"Ciao, come stai oggi?"',
        ),
      ),
    ).toBe('Ciao, come stai oggi?')
  })

  /* The spelling the prompt used before #688 put "in English" beside the line.
     Those clips are also the ones generated before #685 timed a burst, so a
     reader that missed this spelling would leave precisely the rows carrying
     the model-chosen durations untouched (#692). */
  it('reads a prompt from before "in English" was added beside the line', () => {
    expect(
      spokenFromClipPrompt('Enzo. On the dock. Speaking to camera: "Ciao."'),
    ).toBe('Ciao.')
  })

  it('says nothing rather than an empty line when there is no spoken part', () => {
    // A silent burst, and a prompt from before the anchors moved into code.
    expect(
      spokenFromClipPrompt(composeClipPrompt('Enzo.', '', 'He waves.', '')),
    ).toBeNull()
    expect(spokenFromClipPrompt('Some older prompt shape.')).toBeNull()
    // Spoken, but with nothing in the quotes: a line, and not the same thing.
    expect(
      spokenFromClipPrompt('Enzo. Speaking to camera, in English: ""'),
    ).toBe('')
  })
})
