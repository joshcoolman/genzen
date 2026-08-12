'use server'

import { generateText } from 'ai'
import generatePromptSkill from '#/lib/prompts/generate-prompt.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { resolveAuth } from '#/lib/server/auth.server'

interface GeneratePromptInput {
  /** A light nudge from the dialog's Additional instructions field. */
  guidance?: string
  /** Prompts already shown this session, so a reroll goes somewhere new. */
  avoid?: Array<string>
  /**
   * "More like this": the prompt on screen, used as a seed. The opposite pull
   * to `avoid` — stay in its territory instead of leaving it.
   */
  like?: string
}

/** The .md is prompt-craft a human edits, so it keeps the frontmatter block the
 *  skills registry used to read. It is metadata, not instruction — strip it. */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw.trim()
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return raw.trim()
  return raw.slice(end + 4).trim()
}

/**
 * Invent a prompt from nothing. The opposite operation to `enhancePrompt`,
 * which expands text it is given -- running that one on an empty field is what
 * produced the verbose output this exists to avoid.
 */
export async function generatePrompt(data: GeneratePromptInput = {}) {
  await resolveAuth()
  requireAiRole('reasoning')

  const guidance = data.guidance?.trim()
  // Only the last few. The whole session's worth would crowd out the
  // instructions and start reading as a style to imitate.
  const avoid = (data.avoid ?? []).filter(Boolean).slice(-4)

  const like = data.like?.trim()

  const parts = ['Write one image prompt.']
  if (guidance) {
    parts.push(`Direction to work inside (not text to restate):\n${guidance}`)
  }
  // Before `avoid`, and it wins where they pull against each other: the user
  // asked for more of this specific thing, which is a stronger signal than the
  // standing instruction to keep moving.
  if (like) {
    parts.push(
      `Stay in the same territory as this one -- its subject area, register and kind of visual interest -- but make a genuinely different image, not a reword:\n${like}`,
    )
  }
  if (avoid.length > 0) {
    parts.push(
      `Already shown to this user. Go somewhere genuinely different:\n${avoid
        .map((p) => `- ${p}`)
        .join('\n')}`,
    )
  }

  const response = await generateText({
    model: ai.reasoning,
    // Room for the prompt and nothing else. A generous ceiling here is an
    // invitation to write the long version the contract is trying to prevent.
    maxOutputTokens: 200,
    // Higher than the default on purpose: two rolls in a row landing on the
    // same idea is the failure mode that makes the button feel broken.
    temperature: 1,
    system: stripFrontmatter(generatePromptSkill),
    messages: [{ role: 'user', content: parts.join('\n\n') }],
  })

  const prompt = response.text.trim()
  if (!prompt) {
    throw new Error('Model returned an empty response.')
  }

  return { prompt }
}
