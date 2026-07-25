import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'

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
