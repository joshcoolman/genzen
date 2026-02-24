import { anthropic } from '@ai-sdk/anthropic'

export const ai = {
  haiku: anthropic('claude-haiku-4-5-20251001'),
  sonnet: anthropic('claude-sonnet-4-6'),
}
