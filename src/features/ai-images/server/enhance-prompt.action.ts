'use server'

import { generateText } from 'ai'
import enhancePromptSkill from '#/lib/prompts/enhance-prompt.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { promptGuideFor } from '#/lib/server/prompt-guides.server'
import { resolveAuth } from '#/lib/server/auth.server'

interface EnhancePromptInput {
  prompt: string
  /**
   * Which model is about to receive this (#463). When it declares a
   * `promptGuide`, that file replaces `enhance-prompt.md` outright rather than
   * appending to it: FLUX.2 wants a comma-separated slot order and Nano Banana
   * wants narrative sentences, and a shared base with a per-model tail can only
   * vary the wording, never the structure.
   *
   * Optional, and most of the lineup has no guide -- those enhance exactly as
   * they did before.
   */
  modelSlug?: string
}

export async function enhancePrompt(data: EnhancePromptInput) {
  await resolveAuth()
  requireAiRole('reasoning')

  const trimmed = data.prompt.trim()
  if (!trimmed) {
    throw new Error('Prompt is empty — nothing to enhance.')
  }

  const guide = promptGuideFor(data.modelSlug)

  const response = await generateText({
    model: ai.reasoning,
    maxOutputTokens: 600,
    system: guide ?? enhancePromptSkill.trim(),
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

  return { enhancedPrompt: enhanced, guided: guide != null }
}
