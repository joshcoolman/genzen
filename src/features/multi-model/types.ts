import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'

export interface ModelCellState {
  id: string // '0' through '8'
  model: ImageModel
  isEnabled: boolean
  generations: Array<SavedAiImage> // all generations for this cell (newest last)
  currentSlideIndex: number // which generation is shown
  pendingId: string | null // user_images.id currently pending
}

export interface LibraryImage {
  id: string
  title: string
  source: string
  storage_path: string
  [key: string]: unknown
}

export interface MultiModelState {
  cells: Array<ModelCellState>
  systemPrompt: string
  setSystemPrompt: (v: string) => void
  userPrompt: string
  setUserPrompt: (v: string) => void
  aspectRatio: string
  setAspectRatio: (v: string) => void
  orientation: 'landscape' | 'portrait'
  setOrientation: (v: 'landscape' | 'portrait') => void
  sourceImage: { base64: string; name: string; id?: string } | null
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string, id?: string) => void
  clearSourceImage: () => void
  imageUrls: Record<string, string>
  isGeneratingAll: boolean
  generateAll: () => Promise<void>
  runCell: (cellId: string) => Promise<void>
  toggleCell: (cellId: string) => void
  setCellModel: (cellId: string, model: ImageModel) => void
  setCellSlide: (cellId: string, index: number) => void
  lightboxOpen: boolean
  lightboxIndex: number
  lightboxImages: Array<{ id: string; url: string; title: string }>
  openLightbox: (cellId: string, slideIndex: number) => void
  closeLightbox: () => void
  lightboxNext: () => void
  lightboxPrev: () => void
  enabledCount: number
  error: string | null
  clearAll: () => void
  accessToken: string | null
  userImages: {
    images: Array<LibraryImage>
    imageUrls: Record<string, string>
    isLoading: boolean
    refresh: () => Promise<void>
  }
}
