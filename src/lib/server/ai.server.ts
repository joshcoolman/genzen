import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { AiProvider } from '#/lib/ai-keys'
import { AI_PROVIDERS, missingKeyMessage } from '#/lib/ai-keys'

// All available model instances
export const models = {
  haiku: anthropic('claude-haiku-4-5-20251001'),
  sonnet: anthropic('claude-sonnet-4-6'),
  gemini3Flash: google('gemini-3-flash-preview'),
}

// Role assignments - change one line to swap what model handles each job
export const ai = {
  fast: models.haiku,
  reasoning: models.sonnet,
  vision: models.gemini3Flash,
}

/** Which provider's key each role needs. Keep in step with `ai` above. */
const ROLE_PROVIDER: Record<keyof typeof ai, AiProvider> = {
  fast: 'anthropic',
  reasoning: 'anthropic',
  vision: 'google',
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
