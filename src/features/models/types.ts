export interface FalModel {
  endpoint_id: string
  display_name: string
  description: string
  category: string
  tags: Array<string>
  thumbnail_url: string | null
  status: string
  date: string
}

interface FalApiModelEntry {
  endpoint_id: string
  metadata?: {
    display_name?: string
    category?: string
    description?: string
    status?: string
    tags?: Array<string>
    thumbnail_url?: string | null
    date?: string
  }
}

export interface FalApiModelsResponse {
  models?: Array<FalApiModelEntry>
  next_cursor?: string | null
  has_more?: boolean
}

export interface FalModelPricing {
  endpoint_id: string
  pricing: {
    base_price: number
    per_megapixel?: number
    per_second?: number
    unit?: string
    description?: string
  } | null
}

export type ModelCategory =
  | 'all'
  | 'text-to-image'
  | 'image-to-video'
  | 'text-to-video'
