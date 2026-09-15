import { anthropic } from '@ai-sdk/anthropic'
import type { AiProvider } from '#/lib/ai-keys'
import { AI_PROVIDERS, missingKeyMessage } from '#/lib/ai-keys'

// All available model instances
export const models = {
  haiku: anthropic('claude-haiku-4-5-20251001'),
  sonnet: anthropic('claude-sonnet-4-6'),
  opus: anthropic('claude-opus-5'),
}

// Role assignments - change one line to swap what model handles each job
export const ai = {
  fast: models.haiku,
  reasoning: models.sonnet,
  // Sonnet rather than haiku: the one vision call extracts hex codes, materials
  // and framing positions, so accuracy is load-bearing (#254).
  vision: models.sonnet,
  // Opus at low effort: the Director chat character (#670). The output is
  // three short prompts, so effort is the speed lever, not quality.
  chat: models.opus,
}

/** Which provider's key each role needs. Keep in step with `ai` above. */
const ROLE_PROVIDER: Record<keyof typeof ai, AiProvider> = {
  fast: 'anthropic',
  reasoning: 'anthropic',
  vision: 'anthropic',
  chat: 'anthropic',
}

/**
 * Call before using a model. These keys are optional locally, so without this
 * the AI SDK throws its own generic key error deep inside `generateText` and the
 * UI shows nothing useful — the user is left guessing why a button did nothing.
 * Fail here instead, naming the variable, in a form the client can recognise.
 */
export function requireAiKey(provider: AiProvider): void {
  if (!process.env[AI_PROVIDERS[provider].envVar]) {
    throw new Error(missingKeyMessage(provider))
  }
}

/** `requireAiKey` keyed by role, for call sites that use the `ai` map. */
export function requireAiRole(role: keyof typeof ai): void {
  requireAiKey(ROLE_PROVIDER[role])
}
