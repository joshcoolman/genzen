export interface GenerationResult {
  id: string
  status: 'pending' | 'complete' | 'failed'
  url?: string
  label: string
  prompt?: string
}
