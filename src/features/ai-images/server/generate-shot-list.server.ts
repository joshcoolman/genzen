import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { models } from '@/lib/server/ai.server'
import { SHOT_LIST_SYSTEM, shotListUserContent } from '@/lib/prompts/shot-list'

interface GenerateShotListInput {
  accessToken: string
  imageBase64: string
  count?: number
  guidance?: string
}

export const generateShotList = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateShotListInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const count = Math.min(data.count ?? 6, 12)

    const { text } = await generateText({
      model: models.sonnet,
      system: SHOT_LIST_SYSTEM,
      messages: [
        {
          role: 'user',
          content: shotListUserContent(data.imageBase64, count, data.guidance),
        },
      ],
    })

    const prompts = text
      .split('\n')
      .map((line) =>
        line
          .replace(/^\d+[.)]\s*/, '')
          .replace(/^[-*]\s*/, '')
          .trim(),
      )
      .filter(Boolean)
      .slice(0, count)

    return { prompts }
  })
