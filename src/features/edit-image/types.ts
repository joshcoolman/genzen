export interface SelectedImage {
  id: string
  url: string
  title: string
}

export interface EditResult {
  id: string
  status: 'pending' | 'complete' | 'failed'
  url?: string
  modelName: string
  modelId: string
  prompt?: string
}
