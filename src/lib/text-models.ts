export interface TextModel {
  id: string
  name: string
  provider: string
  description: string
  supportsVision: boolean
  locked?: boolean
  isNew?: boolean
}

export const ALL_TEXT_MODELS: Array<TextModel> = [
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance and speed',
    supportsVision: true,
    locked: true,
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
    id: 'gemma-4',
    name: 'Gemma 4',
    provider: 'Google (OpenRouter)',
    description: 'Open-weight, 256K context, 140 languages',
    supportsVision: true,
    isNew: true,
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    description: 'Creative and unfiltered',
    supportsVision: false,
  },
  {
    id: 'nemotron',
    name: 'Nemotron Super',
    provider: 'NVIDIA (OpenRouter)',
    description: 'Fast reasoning, 120B MoE (12B active)',
    supportsVision: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI (OpenRouter)',
    description: 'Fast and affordable multimodal',
    supportsVision: true,
  },
]

export const LOCKED_TEXT_MODEL_ID = 'claude-sonnet'
