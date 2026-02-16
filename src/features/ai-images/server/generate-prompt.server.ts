import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { generatePrompt } from '../lib/prompt-generator'

interface GeneratePromptInput {
  accessToken: string
}

/**
 * Generate an AI image prompt using template-based generation
 * Replaces the old LLM-based approach with instant, free, deterministic generation
 */
export const generatePromptServer = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    // Generate prompt using template system
    const result = generatePrompt()

    return {
      prompt: result.prompt,
      metadata: result.metadata,
    }
  })
