import { generateText } from 'ai'
import anchorPrompt from '#/lib/prompts/describe-anchor.md'
import reconstructPrompt from '#/lib/prompts/describe-reconstruct.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

// **Not a `.md`, deliberately.** These are the one-line turn that carries the
// image, not instructions that steer the output -- a file containing "Describe
// this image." would be a file nobody would ever open to change the result.
// The steering lives in `describe-anchor.md` and `describe-reconstruct.md`,
// which is what #322 is actually protecting.
const USER_TEXT: Record<string, string> = {
  anchor: 'Describe this image.',
  reconstruct: 'Write an image generation prompt for this image.',
}

export async function describeImage(
  image: string,
  mode: 'anchor' | 'reconstruct',
): Promise<string> {
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

  const { text } = await generateText({
    model: ai.fast,
    system: mode === 'anchor' ? anchorPrompt : reconstructPrompt,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:${mime};base64,${base64}` },
          { type: 'text', text: USER_TEXT[mode] },
        ],
      },
    ],
  })

  return text.trim()
}
