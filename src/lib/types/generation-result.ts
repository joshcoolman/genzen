export interface GenerationResult {
  id: string
  status: 'pending' | 'complete' | 'failed'
  url?: string
  storagePath?: string
  label: string
  prompt?: string
  title?: string
  fileSize?: number
  createdAt?: string
  originalPrompt?: string
  enhancedPrompt?: string
}
