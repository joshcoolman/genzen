import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { SCENE_CELL_COUNT, SCENE_SYSTEM_PROMPT } from '../constants'
import { ai } from '@/lib/server/ai.server'
import { requireAuth } from '@/lib/server/auth.server'

interface GenerateScenePromptsInput {
  accessToken: string
  sourceImageBase64: string
  cellCount?: number
}

export const generateScenePrompts = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateScenePromptsInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const count = data.cellCount ?? SCENE_CELL_COUNT

    // Parse base64 + mime from data URL
    let base64: string
    let mime = 'image/jpeg'

    if (data.sourceImageBase64.startsWith('data:')) {
      const match = data.sourceImageBase64.match(
        /^data:(image\/[^;]+);base64,(.+)$/,
      )
      if (match) {
        mime = match[1]
        base64 = match[2]
      } else {
        base64 = data.sourceImageBase64.replace(/^data:image\/\w+;base64,/, '')
      }
    } else {
      base64 = data.sourceImageBase64
    }

    const { text } = await generateText({
      model: ai.fast,
      system: SCENE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: `data:${mime};base64,${base64}` },
            {
              type: 'text',
              text: `Generate exactly ${count} distinct camera angle prompts for this image. Separate each prompt with an asterisk (*).`,
            },
          ],
        },
      ],
    })

    const prompts = text
      .split('*')
      .map((p) => p.trim())
      .filter((p) => p.length > 10)
      .slice(0, count)

    return { prompts }
  })
