import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface CaptionImageInput {
  imageBase64: string
  accessToken: string
}

export const captionImage = createServerFn({ method: 'POST' })
  .inputValidator((data: CaptionImageInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    // Strip data URL prefix if present
    const base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '')

    const { text } = await generateText({
      model: ai.haiku,
      system:
        'You are an image description engine for an image-to-image generation pipeline. The generative model will receive both your description and the source image. Your job is to anchor the generation, not reconstruct the image from text.\n\nDescribe the image the way a human would at a glance — the essentials only.\n\nInclude:\n- Shot type and framing\n- Subject basics (age range, gender, hair, clothing in broad strokes)\n- Background in 2-3 words\n- Lighting quality\n- Any single standout visual detail\n\nRules:\n- Keep it under 40 words\n- No interpretation, no emotion, no narrative\n- No specific facial expressions\n- Broad strokes, not forensic detail\n- Comma-separated phrases or one short sentence',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: base64Data },
            {
              type: 'text',
              text: 'Describe this image.',
            },
          ],
        },
      ],
    })

    return { caption: text.trim() }
  })
