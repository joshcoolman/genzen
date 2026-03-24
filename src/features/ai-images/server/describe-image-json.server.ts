import { createServerFn } from '@tanstack/react-start'
import { generateObject } from 'ai'
import { z } from 'zod'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface DescribeImageJsonInput {
  accessToken: string
  imageUrl: string
  prompt: string
}

const imageSchema = z.object({
  environment: z.object({
    lighting: z
      .string()
      .describe('Primary light source and color temperature (e.g., 2700K)'),
    walls: z.string(),
    flooring: z.string(),
  }),
  objects: z.array(
    z.object({
      name: z.string().describe('Common name of the object'),
      color_hex: z.string().describe('The primary hex code of the object'),
      material: z.string(),
      position: z.string().describe('Relative position in the frame'),
    }),
  ),
})

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

    const { object } = await generateObject({
      model: ai.vision,
      maxOutputTokens: 4096,
      system:
        'You are a precise visual analysis engine. Output coordinates and attributes for image editing.',
      schema: imageSchema,
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
              text: data.prompt,
            },
          ],
        },
      ],
    })

    return { json: JSON.stringify(object, null, 2) }
  })
