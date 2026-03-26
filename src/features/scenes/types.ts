import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'

export interface SceneCellState {
  id: string // '0'–'9'
  prompt: string // editable per-cell prompt
  generations: Array<SavedAiImage>
  currentSlideIndex: number
  pendingId: string | null
}

export interface LibraryImage {
  id: string
  title: string
  source: string
  storage_path: string
  [key: string]: unknown
}

export interface ScenesState {
  cells: Array<SceneCellState>
  setCellPrompt: (cellId: string, prompt: string) => void
  setCellSlide: (cellId: string, index: number) => void
  model: ImageModel
  setModel: (model: ImageModel) => void
  aspectRatio: string
  setAspectRatio: (v: string) => void
  orientation: 'landscape' | 'portrait'
  setOrientation: (v: 'landscape' | 'portrait') => void
  sourceImage: { base64: string; name: string; id?: string } | null
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string, id?: string) => void
  clearSourceImage: () => void
  textPrompt: string
  setTextPrompt: (v: string) => void
  isGeneratingPrompts: boolean
  generatePrompts: () => Promise<void>
  regenerateCellPrompt: (cellId: string) => Promise<void>
  isGeneratingAll: boolean
  generateAll: () => Promise<void>
  runCell: (cellId: string) => Promise<void>
  imageUrls: Record<string, string>
  lightboxOpen: boolean
  lightboxIndex: number
  lightboxImages: Array<{ id: string; url: string; title: string }>
  openLightbox: (cellId: string, slideIndex: number) => void
  closeLightbox: () => void
  lightboxNext: () => void
  lightboxPrev: () => void
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
