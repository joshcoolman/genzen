import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'

export const ai = {
  haiku: anthropic('claude-haiku-4-5-20251001'),
  sonnet: anthropic('claude-sonnet-4-6'),
  geminiFlash: google('gemini-2.0-flash'),
}
