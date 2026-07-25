import { generateText } from 'ai'
import { ai, requireAiRole } from '@/lib/server/ai.server'

const ANCHOR_PROMPT = `You are an image description engine for an image-to-image generation pipeline. The generative model will receive both your description and the source image. Your job is to anchor the generation, not reconstruct the image from text.

Describe the image the way a human would at a glance — the essentials only.

Include:
- Shot type and framing
- Subject basics (age range, gender, hair, clothing in broad strokes)
- Background in 2-3 words
- Lighting quality
- Any single standout visual detail

Rules:
- Keep it under 40 words
- No interpretation, no emotion, no narrative
- No specific facial expressions
- Broad strokes, not forensic detail
- Comma-separated phrases or one short sentence`

const RECONSTRUCT_PROMPT = `You are an image-to-prompt converter for an image generation pipeline. Your output will be fed directly to a text-to-image model as the prompt. Output ONLY the prompt text -- no headers, labels, hashtags, markdown, or commentary.

Write a concise visual description suitable for image generation. Include:
- Subject and composition
- For people: specific physical appearance -- ethnicity, gender, approximate age, build, hair color/style, and distinguishing features. These details are critical for generation fidelity.
- Style, medium, and artistic qualities
- Lighting, color palette, and mood
- Key visual details

Keep it under 400 characters. Plain text only. No line breaks.`

const USER_TEXT: Record<string, string> = {
  anchor: 'Describe this image.',
  reconstruct: 'Write an image generation prompt for this image.',
}

export async function describeImage(
  image: string,
  mode: 'anchor' | 'reconstruct',
): Promise<string> {
  // Guarding here rather than at each caller is deliberate: `caption-image`
  // is user-initiated and should surface the missing key, while
  // `generate-image-internal` already wraps this in a try/catch and falls back
  // to a placeholder prompt — exactly the right behaviour in each case.
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
    system: mode === 'anchor' ? ANCHOR_PROMPT : RECONSTRUCT_PROMPT,
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
