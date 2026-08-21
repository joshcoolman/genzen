'use server'

import { generateText } from 'ai'
import enhancePromptSkill from '#/lib/prompts/enhance-prompt.md'
import steeringFrame from '#/lib/prompts/steering-frame.md'
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
  /**
   * The user's standing direction about what the picture should *be* -- world,
   * medium, palette, mood.
   *
   * **It is appended below the guide, never merged into it, and it loses every
   * conflict.** The two are answering different questions: the guide owns form
   * (how this model reads) and the steering owns look. That split is the whole
   * design, because steering is typically pasted in from another session and
   * arrives as a complete instruction of its own -- a word count, a numbered
   * structure, an output rule, a banned-word list. Merged in, those fight the
   * guide's own numbers and the model picks a winner differently every run.
   * `steering-frame.md` is the prose that tells it to take the look and discard
   * the format; this module only decides where the three pieces sit.
   */
  steering?: string
}

export async function enhancePrompt(data: EnhancePromptInput) {
  await resolveAuth()
  requireAiRole('reasoning')

  const trimmed = data.prompt.trim()
  if (!trimmed) {
    throw new Error('Prompt is empty — nothing to enhance.')
  }

  const guide = promptGuideFor(data.modelSlug)
  const instruction = guide ?? enhancePromptSkill.trim()
  const steering = data.steering?.trim()

  const response = await generateText({
    model: ai.reasoning,
    // Steered runs are longer by construction, and a truncated prompt reads as
    // a bad instruction rather than a hit ceiling.
    maxOutputTokens: steering ? 1000 : 600,
    system: steering
      ? `${instruction}\n\n${steeringFrame.trim()}\n\n${steering}`
      : instruction,
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
