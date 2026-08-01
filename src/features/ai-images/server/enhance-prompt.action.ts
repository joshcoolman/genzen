'use server'

import { generateText } from 'ai'
import enhancePromptSkill from '#/lib/prompts/enhance-prompt.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { resolveAuth } from '#/lib/server/auth.server'

interface EnhancePromptInput {
  prompt: string
}

/** The .md is prompt-craft a human edits, so it keeps the frontmatter block the
 *  skills registry used to read. It is metadata, not instruction — strip it. */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw.trim()
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return raw.trim()
  return raw.slice(end + 4).trim()
}

export async function enhancePrompt(data: EnhancePromptInput) {
  await resolveAuth()
  requireAiRole('reasoning')

  const trimmed = data.prompt.trim()
  if (!trimmed) {
    throw new Error('Prompt is empty — nothing to enhance.')
  }

  const response = await generateText({
    model: ai.reasoning,
    maxOutputTokens: 600,
    system: stripFrontmatter(enhancePromptSkill),
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
}
