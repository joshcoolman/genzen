import type { GenerationInputImage } from '#/features/ai-images/generation-inputs'

export type GenerationStatus = 'pending' | 'completed' | 'failed'

/**
 * What a row produced. Clips were absent from Activity entirely until #398 --
 * the query filtered `ai_generated` while the log's whole purpose is recording
 * what a generation cost, and clips are the only generations where that
 * question is interesting.
 */
export type ActivitySource = 'ai_generated' | 'ai_video'

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
  /** Written by the video submit (#367). The name of a model, pinned at submit
   *  time, for rows whose endpoint the image lineup cannot resolve. */
  model_label?: string
  /** Video only. What was asked for, not what came back. */
  duration_seconds?: number
  resolution?: string
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
  /** The row was selected with this and `parseEntry` dropped it, so the client
   *  could not branch on it even where it needed to (#398). */
  source: ActivitySource
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

/**
 * Aliased rather than redeclared (#380). Activity shows the images a
 * generation was given, and so will the image card -- one shape, resolved in
 * one place (`ai-images/server/generation-inputs.server.ts`), because two
 * structurally identical declarations are how the underlying metadata fields
 * drifted apart to begin with.
 */
export type ActivityReferenceImage = GenerationInputImage

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
