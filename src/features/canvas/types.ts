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
