import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface ExtractStoryElementsInput {
  story: string
  accessToken: string
}

const SYSTEM_PROMPT = `Identify the 6-8 key subjects and scenes from this story. Each one should be something a photographer could point a camera at -- a person, a place, an action, or a moment. Think "what would a film's shot list focus on?"

Avoid abstract concepts, textures, or fragments. Every label should describe a coherent, filmable subject.

Return ONLY a JSON array of short labels (2-6 words each). No explanation, no markdown fences.

Example: ["the girl discovering the hidden door","the beetle architect with blueprints","the grand bark cathedral","insect workers building bridges","the approaching storm","the girl rallying the workers"]`

export const extractStoryElements = createServerFn({ method: 'POST' })
  .inputValidator((data: ExtractStoryElementsInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!data.story.trim()) {
      throw new Error('Story text is required')
    }

    const { text } = await generateText({
      model: ai.haiku,
      system: SYSTEM_PROMPT,
      prompt: data.story.trim().slice(0, 2000),
    })

    // Strip markdown fences if present
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .trim()

    try {
      const elements = JSON.parse(cleaned) as Array<string>
      if (!Array.isArray(elements)) throw new Error('Not an array')
      return { elements: elements.map((e) => String(e).trim()).filter(Boolean) }
    } catch {
      const lines = cleaned
        .replace(/[\[\]"]/g, '')
        .split(/[,\n]/)
        .map((l) => l.trim())
        .filter(Boolean)
      return { elements: lines }
    }
  })
