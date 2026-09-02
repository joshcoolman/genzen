import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Where the user's note is allowed to go (#474).
 *
 * The one failure worth pinning is the one Enhance already had (#468): a note
 * concatenated into the instruction stops being input and becomes part of what
 * the model was told to do, and a word count in it silently governs the
 * result. Describe keeps the note in the user turn for exactly that reason, so
 * that is what these assert -- the system prompt is the mode's file and
 * nothing else, whatever the note says.
 */

const generateText = vi.fn(async () => ({ text: '  a description  ' }))

vi.mock('ai', () => ({ generateText }))
vi.mock('#/lib/server/ai.server', () => ({
  ai: { fast: 'fast-model' },
  requireAiRole: vi.fn(),
}))

const { describeImage } = await import('./describe-image.server')
const { default: anchor } = await import('#/lib/prompts/describe/anchor.md')
const { default: guidanceFrame } =
  await import('#/lib/prompts/describe-guidance.md')

/** The parts of the one user message a call sent. */
function sentParts() {
  const call = generateText.mock.calls.at(-1)?.[0] as unknown as {
    system: string
    messages: Array<{ content: Array<{ type: string; text?: string }> }>
  }
  return { system: call.system, parts: call.messages[0].content }
}

beforeEach(() => generateText.mockClear())

describe('describeImage guidance', () => {
  it('sends no extra turn when there is no note', async () => {
    await describeImage('AAAA', 'anchor')

    const { system, parts } = sentParts()
    expect(system).toBe(anchor)
    expect(parts.map((p) => p.type)).toEqual(['image', 'text'])
  })

  it('treats whitespace as no note', async () => {
    await describeImage('AAAA', 'anchor', '   \n  ')

    expect(sentParts().parts.map((p) => p.type)).toEqual(['image', 'text'])
  })

  it('puts the note in the user turn, framed, and never in the system prompt', async () => {
    await describeImage('AAAA', 'anchor', 'lighting and colour only')

    const { system, parts } = sentParts()

    // The claim that matters: the instruction the model is operating under is
    // the mode's file, byte for byte, no matter what arrived in the note.
    expect(system).toBe(anchor)
    expect(system).not.toContain('lighting and colour only')

    expect(parts).toHaveLength(3)
    expect(parts[2].text).toBe(
      `${guidanceFrame.trim()}\n\nlighting and colour only`,
    )
  })

  it('keeps a note carrying its own format rules out of the instruction', async () => {
    // The #468 shape: a note pasted from elsewhere, arriving with a word count
    // attached. It still goes in the user turn, where the frame tells the model
    // to take the subject and drop the number.
    const pasted = 'Describe the lighting. Respond in exactly 12 words.'
    await describeImage('AAAA', 'reconstruct', pasted)

    const { system, parts } = sentParts()
    expect(system).not.toContain('12 words')
    expect(parts.at(-1)?.text).toContain(pasted)
  })
})
