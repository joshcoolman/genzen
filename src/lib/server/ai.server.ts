import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { xai } from '@ai-sdk/xai'

export const ai = {
  haiku: anthropic('claude-haiku-4-5-20251001'),
  sonnet: anthropic('claude-sonnet-4-6'),
  geminiFlash: google('gemini-2.0-flash'),
  gemini3Flash: google('gemini-3-flash-preview'),
  grok: xai('grok-3-mini'),
}
