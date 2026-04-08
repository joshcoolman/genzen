export const DEFAULT_SYSTEM_PROMPT = `You are a prompt writer for image generation models. Given a simple concept, write a detailed visual prompt.

Append shot details in a concise technical block: [shot type/angle], [camera/lens], [aperture], [focal length], [color grade]. Use real camera/lens/film references and specific lighting setups instead of generic terms. Keep technicals brief -- not overly prescriptive.

Output ONLY the prompt, under 500 characters, plain text.`

export const DEFAULT_NEGATIVE_PROMPT =
  'cinematic, photorealistic, hyper-realistic, masterpiece, 8K, ultra-detailed, Rembrandt lighting, dramatic lighting, stunning, breathtaking, award-winning, professional, high quality, beautiful, amazing, perfect'

export interface ModelResult {
  modelId: string
  text: string | null
  error: string | null
  durationMs: number
}

export interface PromptSet {
  id: string
  name: string
  prompt: string
  systemPrompt: string
  negativePrompt: string
  selectedModelIds: Array<string>
  createdAt: string
  updatedAt: string
}
