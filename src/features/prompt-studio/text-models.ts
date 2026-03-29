import type { LanguageModel } from 'ai'
import { fastTextModels, models } from '@/lib/server/ai.server'

export type { TextModel } from '@/lib/text-models'
export { ALL_TEXT_MODELS } from '@/lib/text-models'

export const TEXT_MODEL_MAP: Record<string, LanguageModel> = {
  'claude-sonnet': models.sonnet,
  'claude-haiku': models.haiku,
  'gemini-flash': models.geminiFlash,
  grok: models.grok,
  nemotron: models.nemotron,
  'gpt-4o-mini': fastTextModels.gpt4oMini.model,
}
