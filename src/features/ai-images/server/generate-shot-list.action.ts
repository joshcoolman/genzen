'use server'

import { generateText } from 'ai'
import { resolveAuth } from '#/lib/server/auth.server'
import { models, requireAiKey } from '#/lib/server/ai.server'
import { SHOT_LIST_SYSTEM, shotListUserContent } from '#/lib/prompts/shot-list'

interface GenerateShotListInput {
  imageBase64: string
  count?: number
  guidance?: string
}

export async function generateShotList(data: GenerateShotListInput) {
  requireAiKey('anthropic')
  await resolveAuth()

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
}
