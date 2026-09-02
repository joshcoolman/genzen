import { generateText } from 'ai'
import type { DescribeMode } from '#/lib/prompts/describe'
import { describeMode } from '#/lib/prompts/describe'
import describeGuidance from '#/lib/prompts/describe-guidance.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

export async function describeImage(
  image: string,
  mode: DescribeMode,
  /**
   * The user's note about what they want described (#474).
   *
   * **It rides in the user turn, never merged into the mode's instruction
   * file.** Enhance's steering goes in the system prompt because it is a
   * standing preference the guide has to arbitrate against; this is a
   * one-shot question about the picture in front of you, and it belongs beside
   * the picture. Keeping it out of the system prompt also means the mode's
   * contract -- what kind of output this is -- is never something the note is
   * in a position to overwrite, which is the shape of the leak #468 found in
   * Enhance: a pasted note's word count ended up in the result because it was
   * concatenated into the instruction rather than framed as input.
   *
   * `describe-guidance.md` is the framing that says take the subject and
   * discard the format. Empty or absent is the previous behaviour exactly.
   */
  guidance?: string,
): Promise<string> {
  const { system, userText } = describeMode(mode)

  // Guarding here rather than at each caller, and **every caller now surfaces
  // it**. This comment used to say `generate-image-internal` caught the throw
  // and fell back to a placeholder prompt, calling that the right behaviour;
  // it was not (#365). That fallback generated at full price on the one-word
  // prompt "image", and with no ANTHROPIC_API_KEY it did so on every
  // image-only generation, silently, forever.
  requireAiRole('fast')

  // Normalize input to base64 + mime
  let base64: string
  let mime = 'image/jpeg'

  if (image.startsWith('data:')) {
    // data URL → extract mime and base64
    const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/)
    if (match) {
      mime = match[1]
      base64 = match[2]
    } else {
      // Fallback: strip prefix
      base64 = image.replace(/^data:image\/\w+;base64,/, '')
    }
  } else if (image.startsWith('http://') || image.startsWith('https://')) {
    // Remote URL → fetch → buffer → base64
    const response = await fetch(image)
    if (!response.ok) {
      throw new Error('Failed to fetch image')
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    mime = contentType.split(';')[0].trim()
    base64 = buffer.toString('base64')
  } else {
    // Raw base64
    base64 = image
  }

  const note = guidance?.trim()

  const { text } = await generateText({
    model: ai.fast,
    system: (await system()).default,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:${mime};base64,${base64}` },
          { type: 'text', text: userText },
          // A part of its own rather than appended to `userText`: the frame is
          // addressed to the model about the note, and running the two
          // together makes the note read as part of the standing turn.
          ...(note
            ? [
                {
                  type: 'text' as const,
                  text: `${describeGuidance.trim()}\n\n${note}`,
                },
              ]
            : []),
        ],
      },
    ],
  })

  return text.trim()
}
