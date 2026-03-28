import type { LanguageModel } from 'ai'
import { models } from '@/lib/server/ai.server'

export interface TextModel {
  id: string
  name: string
  provider: string
  description: string
  supportsVision: boolean
}

export const TEXT_MODELS: Array<TextModel> = [
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance and speed',
    supportsVision: true,
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    provider: 'Anthropic',
    description: 'Fast and lightweight',
    supportsVision: true,
  },
  {
    id: 'gemini-flash',
    name: 'Gemini Flash',
    provider: 'Google',
    description: 'Fast multimodal with long context',
    supportsVision: true,
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    description: 'Creative and unfiltered',
    supportsVision: true,
  },
  {
    id: 'nemotron',
    name: 'Nemotron Super',
    provider: 'NVIDIA (OpenRouter)',
    description: 'Fast reasoning, 120B MoE (12B active)',
    supportsVision: false,
  },
]

export const TEXT_MODEL_MAP: Record<string, LanguageModel> = {
  'claude-sonnet': models.sonnet,
  'claude-haiku': models.haiku,
  'gemini-flash': models.geminiFlash,
  grok: models.grok,
  nemotron: models.nemotron,
}
