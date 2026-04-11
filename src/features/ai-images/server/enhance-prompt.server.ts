import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { ai } from '@/lib/server/ai.server'
import { requireAuth } from '@/lib/server/auth.server'
import { getSkill } from '@/features/ad/skills/registry'

interface EnhancePromptInput {
  accessToken: string
  prompt: string
}

export const enhancePrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: EnhancePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const trimmed = data.prompt.trim()
    if (!trimmed) {
      throw new Error('Prompt is empty — nothing to enhance.')
    }

    const skill = getSkill('enhance-prompt')
    if (!skill) {
      throw new Error(
        'Enhance Prompt skill not found in registry. Check src/lib/prompts/skills/enhance-prompt.md.',
      )
    }

    const response = await generateText({
      model: ai.reasoning,
      maxOutputTokens: 600,
      system: skill.body,
      messages: [
        {
          role: 'user',
          content: `Here is the prompt to enhance. Return ONLY the final enhanced prompt text — no preamble, no markdown, no explanation, no quotes around it.\n\nPrompt:\n${trimmed}`,
        },
      ],
    })

    const enhanced = response.text.trim()
    if (!enhanced) {
      throw new Error('Model returned an empty response.')
    }

    return { enhancedPrompt: enhanced }
  })
