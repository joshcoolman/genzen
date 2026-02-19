import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { generatePromptComponents } from '../lib/prompt-generator'
import type { PromptTheme } from '../lib/prompt-types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface GeneratePromptInput {
  accessToken: string
  theme?: PromptTheme
}

const ASSEMBLY_PROMPT = `You are a photography prompt assembler. I'll give you modular components, and you create a natural, vivid photography prompt.

FORMAT: [Subject with details], [camera specs] --ar X:Y

RULES:
- Make it flow naturally and be specific
- Include all technical specs exactly as provided
- Add vivid details that make good photos
- Keep it concise (one sentence for subject)
- Be creative with the details but stay true to components

EXAMPLES:

Components: person, Korean, woman, young, scientist, examining specimens, 50mm f/1.4, Portra 400, medium shot, 3:2
Output: A young Korean woman scientist examining bioluminescent specimens under UV light, 50mm f/1.4, Kodak Portra 400, medium shot --ar 3:2

Components: couple, mixed-ethnicity, shopping, at a market, 35mm f/2, Tri-X 400, 16:9
Output: A mixed-ethnicity couple browsing fresh produce at a bustling street market, 35mm f/2, Kodak Tri-X 400, wide shot --ar 16:9

Return ONLY the assembled prompt (plain text, no markdown).`

/**
 * Generate prompt using modular components + Claude assembly
 * Picks random components, Claude makes it natural
 */
export const generatePromptServer = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }

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
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: [
          {
            type: 'text',
            text: fantasyPrefix + ASSEMBLY_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: componentString,
          },
        ],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response')
      }

      const prompt = textContent.text.trim()

      // Calculate cost
      const usage = response.usage
      const estimatedCost =
        ((usage.input_tokens - (usage.cache_read_input_tokens ?? 0)) * 0.25 +
          (usage.cache_read_input_tokens ?? 0) * 0.025 +
          usage.output_tokens * 1.25) /
        1_000_000

      return {
        prompt,
        components, // Return components for debugging
        metadata: {
          cost: estimatedCost,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        },
      }
    } catch (err) {
      console.error('Prompt generation error:', err)
      throw new Error(
        `Failed to generate prompt: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  })
