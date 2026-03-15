import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface DescribeImageJsonInput {
  accessToken: string
  imageUrl: string
}

export const describeImageJson = createServerFn({ method: 'POST' })
  .inputValidator((data: DescribeImageJsonInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const imageRes = await fetch(data.imageUrl)
    const buffer = await imageRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
      'image/jpeg'
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      mediaType = 'image/png'
    } else if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      mediaType = 'image/webp'
    }

    const base64 = Buffer.from(buffer).toString('base64')

    const response = await generateText({
      model: ai.sonnet,
      maxOutputTokens: 4096,
      system: `You are an image analysis assistant. Describe the given image as a structured JSON object. Include these fields:
- subject: what/who is the main subject
- setting: where the scene takes place
- lighting: describe the lighting conditions
- mood: the emotional tone or atmosphere
- colors: array of dominant colors
- style: artistic style (photorealistic, illustration, etc.)
- composition: how the frame is composed (close-up, wide shot, etc.)
- details: array of notable details or elements
- action: what is happening in the scene
- textures: array of notable textures or materials

Return ONLY valid JSON, no markdown fences, no explanation.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: `data:${mediaType};base64,${base64}`,
            },
            {
              type: 'text',
              text: 'Describe this image as structured JSON.',
            },
          ],
        },
      ],
    })

    return { json: response.text.trim() }
  })
