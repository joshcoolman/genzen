export interface CanvasImage {
  id: string
  /** Required link to user_images record */
  recordId: string
  /** Supabase storage path (persisted for signed URL generation) */
  storagePath: string
  x: number
  y: number
  width: number
  height: number
  pending?: boolean
  /** Generation failed -- the tile persists (model + error) instead of vanishing. */
  failed?: boolean
  /** Failure reason shown on the failed tile. */
  errorMessage?: string
  /** generation_metadata.model id -- drives the on-canvas model label. */
  model?: string
  /** Runtime only -- not persisted. Cached signed URL for display. */
  signedUrl?: string
}

export interface Transform {
  x: number
  y: number
  scale: number
}

export interface CanvasGroup {
  id: string
  imageIds: Array<string>
  columns: number
  padding: number
}

export interface PersistedState {
  images: Array<CanvasImage>
  transform: Transform
  groups?: Array<CanvasGroup>
}

export type DragMode = 'pan' | 'move' | 'marquee' | null
