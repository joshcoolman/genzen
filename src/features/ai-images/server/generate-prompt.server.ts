import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { generatePromptComponents } from '../lib/prompt-generator'
import type { PromptTheme } from '../lib/prompt-types'
import { ai } from '@/lib/server/ai.server'
import { requireAuth } from '@/lib/server/auth.server'
import { ASSEMBLE_PROMPT_SYSTEM } from '@/lib/prompts'

interface GeneratePromptInput {
  accessToken: string
  theme?: PromptTheme
}

/**
 * Generate prompt using modular components + Claude assembly
 * Picks random components, Claude makes it natural
 */
export const generatePromptServer = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    try {
      // 1. Generate random components
      const components = generatePromptComponents({ theme: data.theme })

      // 2. Build component description for Claude
      const parts = [`${components.subjectType}`]

      if (components.subjectType === 'person') {
        if (components.ethnicity) parts.push(components.ethnicity)
        if (components.gender) parts.push(components.gender)
        if (components.age) parts.push(components.age)
        if (components.descriptor) parts.push(components.descriptor)
        if (components.bodyType) parts.push(components.bodyType)
        if (components.profession) parts.push(components.profession)
      } else if (components.subjectType === 'couple') {
        if (components.relationship) parts.push(components.relationship)
        if (components.ethnicity) parts.push(components.ethnicity)
        if (components.age) parts.push(components.age)
        if (components.descriptor) parts.push(components.descriptor)
      } else if (components.subjectType === 'animal') {
        if (components.animalType) parts.push(components.animalType)
        if (components.descriptor) parts.push(components.descriptor)
      } else if (components.subjectType === 'object') {
        if (components.objectType) parts.push(components.objectType)
        if (components.descriptor) parts.push(components.descriptor)
      } else if (components.subjectType === 'place') {
        if (components.placeType) parts.push(components.placeType)
        if (components.descriptor) parts.push(components.descriptor)
      }

      if (components.action) parts.push(components.action)
      if (components.environment) parts.push(components.environment)

      // Technical
      parts.push(components.lens)
      parts.push(components.film)
      if (components.framing) parts.push(components.framing)
      parts.push(components.aspectRatio)

      const componentString = `Components: ${parts.join(', ')}`

      // 3. Send to Claude for assembly
      const fantasyPrefix =
        data.theme === 'fantasy-scifi'
          ? 'Create a vivid fantasy or sci-fi themed prompt. Lean into genre imagery -- magic, technology, alien worlds, mythical creatures.\n\n'
          : ''

      const response = await generateText({
        model: ai.haiku,
        maxOutputTokens: 200,
        system: fantasyPrefix + ASSEMBLE_PROMPT_SYSTEM,
        messages: [{ role: 'user', content: componentString }],
      })

      const prompt = response.text.trim()

      const usage = response.usage
      const estimatedCost =
        ((usage.inputTokens ?? 0) * 0.25 + (usage.outputTokens ?? 0) * 1.25) /
        1_000_000

      return {
        prompt,
        components,
        metadata: {
          cost: estimatedCost,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: 0,
        },
      }
    } catch (err) {
      console.error('Prompt generation error:', err)
      throw new Error(
        `Failed to generate prompt: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  })
