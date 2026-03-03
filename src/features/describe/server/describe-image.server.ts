import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

const IMAGE_TO_PROMPT = `You are an image-to-prompt converter for an image generation pipeline. Your output will be fed directly to a text-to-image model as the prompt. Output ONLY the prompt text -- no headers, labels, hashtags, markdown, or commentary.

Write a concise visual description suitable for image generation. Include:
- Subject and composition
- Style, medium, and artistic qualities
- Lighting, color palette, and mood
- Key visual details

Keep it under 300 characters. Plain text only. No line breaks.`

interface DescribeImageInput {
  imageUrl: string
  accessToken: string
}

export const describeImage = createServerFn({ method: 'POST' })
  .inputValidator((data: DescribeImageInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    let dataUrl: string

    if (data.imageUrl.startsWith('data:')) {
      // Already a data URL (uploaded/pasted on client)
      dataUrl = data.imageUrl
    } else {
      // Remote URL -- fetch and convert
      const response = await fetch(data.imageUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch image')
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') ?? 'image/jpeg'
      const mime = contentType.split(';')[0].trim()
      dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
    }

    const { text } = await generateText({
      model: ai.haiku,
      system: IMAGE_TO_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: new URL(dataUrl) },
            {
              type: 'text',
              text: 'Write an image generation prompt for this image.',
            },
          ],
        },
      ],
    })

    return { description: text.trim() }
  })
