export interface CanvasImage {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
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
