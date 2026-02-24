import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DESCRIBE_SYSTEM_PROMPT = `You are an expert image analyst. Given an image, produce a structured JSON description that captures every visual detail needed to recreate it as a text-to-image prompt.

Return ONLY valid JSON with these fields:
{
  "subject": "Detailed description of the main subject - appearance, clothing, age, expression, distinguishing features",
  "action": "What the subject is doing - body language, gestures, movement, interaction with environment",
  "environment": "Setting, background, props, spatial relationships, foreground/background elements",
  "lighting": "Direction, quality, color temperature, shadows, highlights, time of day",
  "color_palette": "Dominant colors, accent colors, overall color mood, saturation level",
  "mood": "Emotional tone, atmosphere, feeling the image conveys",
  "camera": "Angle, distance, lens feel (wide/telephoto), depth of field, perspective",
  "style": "Photographic style, film quality, processing look, artistic references"
}

Be specific and vivid. Describe what you actually see, not what you assume. Keep each field to 1 concise sentence.`

export interface ImageDescription {
  subject: string
  action: string
  environment: string
  lighting: string
  color_palette: string
  mood: string
  camera: string
  style: string
}

export async function describeImage(imageUrl: string): Promise<ImageDescription> {
  // Fetch the image and send as base64 (signed URLs may be HTTP in dev)
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const base64Data = imageBuffer.toString('base64')

  // Detect media type from file magic bytes (headers from Supabase can be unreliable)
  const mediaType = detectMediaType(imageBuffer)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: DESCRIBE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          {
            type: 'text',
            text: 'Describe this image in structured JSON format.',
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude vision response')
  }

  // Extract JSON from response - strip markdown fences, find the JSON object
  let jsonStr = textContent.text.trim()
  // Remove markdown code fences if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
  // As a fallback, extract the first { ... } block
  if (!jsonStr.startsWith('{')) {
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      jsonStr = braceMatch[0]
    }
  }

  return JSON.parse(jsonStr) as ImageDescription
}

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function detectMediaType(buffer: Buffer): SupportedMediaType {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif'
  }
  return 'image/jpeg' // fallback - most AI-generated images are JPEG
}
