export type PromptMode = 'image-prompt' | 'story-beat' | 'free'

export interface PromptModeConfig {
  id: PromptMode
  label: string
  systemPrompt: string
}

export const DEFAULT_NEGATIVE_PROMPT =
  'cinematic, photorealistic, hyper-realistic, masterpiece, 8K, ultra-detailed, Rembrandt lighting, dramatic lighting, stunning, breathtaking, award-winning, professional, high quality, beautiful, amazing, perfect'

export const PROMPT_MODES: Array<PromptModeConfig> = [
  {
    id: 'image-prompt',
    label: 'Image Prompt',
    systemPrompt: `You are a prompt writer for image generation models. Given a simple concept, write a detailed visual prompt.

Append shot details in a concise technical block: [shot type/angle], [camera/lens], [aperture], [focal length], [color grade]. Use real camera/lens/film references and specific lighting setups instead of generic terms. Keep technicals brief -- not overly prescriptive.

Output ONLY the prompt, under 500 characters, plain text.`,
  },
  {
    id: 'story-beat',
    label: 'Story Beat',
    systemPrompt: `You are a creative writer. Given a simple concept, expand it into a vivid narrative scene description. Include character details, setting, atmosphere, and a sense of moment or action. Write in present tense. Output ONLY the scene -- no headers, labels, or commentary. Keep it under 600 characters. Plain text only.`,
  },
  {
    id: 'free',
    label: 'Free',
    systemPrompt: '',
  },
]

export interface ModelResult {
  modelId: string
  text: string | null
  error: string | null
  durationMs: number
}
