export interface GenerationMetadata {
  prompt?: string
  model?: string
  elapsed?: number
  seed?: number | string
  timings?: Record<string, number>
}

export interface HistoryEntry {
  id: string
  storagePath: string
  prompt: string
  modelName: string
  elapsedMs: number | null
  createdAt: string
  seed: string | null
  thumbnailUrl: string | null
}

export type ViewMode = 'list' | 'grid'

export interface HistoryFilters {
  search: string
  page: number
  pageSize: number
}
