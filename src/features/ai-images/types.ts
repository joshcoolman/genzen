export interface SavedAiImage {
  id: string
  title: string
  storage_path: string | null
  created_at: string
  sort_order?: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  generation_error: string | null
  generation_metadata: {
    prompt: string
    model: string
    seed?: number
    elapsed?: number
    generation_type?: string
    source_image_id?: string
    aspect_ratio?: string
    reference_image_ids?: Array<string>
  } | null
}
