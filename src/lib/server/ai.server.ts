import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { xai } from '@ai-sdk/xai'

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

// All available model instances
export const models = {
  haiku: anthropic('claude-haiku-4-5-20251001'),
  sonnet: anthropic('claude-sonnet-4-6'),
  geminiFlash: google('gemini-2.5-flash'),
  gemini3Flash: google('gemini-3-flash-preview'),
  grok: xai('grok-3-mini'),
  nemotron: openrouter.chatModel('nvidia/nemotron-3-super-120b-a12b'),
}

// Role assignments - change one line to swap what model handles each job
export const ai = {
  fast: models.haiku,
  reasoning: models.sonnet,
  vision: models.gemini3Flash,
}
