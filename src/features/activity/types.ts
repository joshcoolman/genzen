export type GenerationStatus = 'pending' | 'completed' | 'failed'

export interface ActivityGenerationMetadata {
  prompt?: string
  model?: string
  provider?: string
  fal_model_id?: string
  generation_type?: string
  submitted_at?: string
  completed_at?: string
  failed_at?: string
  provider_cost_cents?: number
  /** True when the figure came from the pricing table, not from FAL itself. */
  provider_cost_is_estimate?: boolean
  thumbnail_path?: string
  fal_url?: string
  error?: { message?: string } | string
  /** Written only when the endpoint held fewer images than it was given (#341). */
  images_requested?: number
  images_used?: number
}

export interface ActivityEntry {
  id: string
  thumbnailPath: string | null
  prompt: string
  model: string | null
  modelName: string
  provider: string | null
  status: GenerationStatus
  createdAt: string
  submittedAt: string | null
  completedAt: string | null
  failedAt: string | null
  durationMs: number | null
  providerCostCents: number | null
  costIsEstimate: boolean
  isDeleted: boolean
  errorMessage: string | null
}

export interface ActivityFilters {
  models: Array<string>
  statuses: Array<GenerationStatus>
}

export interface ListActivityResult {
  entries: Array<ActivityEntry>
  total: number
}

export interface ActivityReferenceImage {
  id: string
  storagePath: string | null
  isDeleted: boolean
}

export interface ActivityEntryDetail extends ActivityEntry {
  storagePath: string | null
  fileName: string | null
  mimeType: string | null
  fileSize: number | null
  width: number | null
  height: number | null
  falUrl: string | null
  referenceImages: Array<ActivityReferenceImage>
  /** "1 of 5 images" when the endpoint held fewer than it was given, else null
   *  (#341). Null on every ordinary generation. */
  refUsageNote: string | null
  /** JSON-stringified raw `generation_metadata`. Parse on the client. */
  rawMetadataJson: string
}
