export interface SavedAiImage {
  id: string
  title: string
  storage_path: string | null
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  generation_error: string | null
  generation_metadata: {
    prompt: string
    model: string
    seed?: number
    elapsed?: number
    generation_type?: string
    source_image_id?: string
  } | null
}
