import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'
import { ENHANCE_PROMPT_SYSTEM } from '@/lib/prompts'

interface GeneratePromptEnhancedInput {
  accessToken: string
  currentPrompt: string // The prompt to enhance
}

/**
 * Enhance an existing prompt using Claude
 * Takes a simple prompt and makes it more vivid and detailed
 */
export const generatePromptEnhanced = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptEnhancedInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!data.currentPrompt.trim()) {
      throw new Error('No prompt provided to enhance')
    }

    try {
      const response = await generateText({
        model: ai.fast,
        maxOutputTokens: 300,
        system: ENHANCE_PROMPT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Enhance this prompt:\n\n${data.currentPrompt}`,
          },
        ],
      })

      const enhancedPrompt = response.text.trim()

      const usage = response.usage
      const estimatedCost =
        ((usage.inputTokens ?? 0) * 0.25 + (usage.outputTokens ?? 0) * 1.25) /
        1_000_000

      return {
        prompt: enhancedPrompt,
        metadata: {
          cost: estimatedCost,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: 0,
        },
      }
    } catch (err) {
      console.error('Claude prompt enhancement error:', err)
      throw new Error(
        `Failed to enhance prompt: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  })
