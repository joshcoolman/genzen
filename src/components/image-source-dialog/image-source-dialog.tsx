'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { Thumbnail } from '../thumbnail/thumbnail'
import { ImageGrid } from '../image-grid/image-grid'

type SourceFilter = 'all' | 'upload' | 'ai_generated'

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string | null
  [key: string]: unknown
}

export interface ImageSourceResult {
  id: string
  url: string
  title: string
}

interface ImageSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  images: Array<UserImageRow>
  imageUrls: Record<string, string>
  originalUrls?: Record<string, string>
  isLoading: boolean
  onSelect: (result: ImageSourceResult) => void
  /** Upload a file to the library (stays open, grid refreshes) */
  onUploadToLibrary?: (file: File) => Promise<void>
}

export function ImageSourceDialog({
  open,
  onOpenChange,
  title = 'Choose Image',
  images,
  imageUrls,
  originalUrls,
  isLoading,
  onSelect,
  onUploadToLibrary,
}: ImageSourceDialogProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const filteredImages = useMemo(() => {
    if (sourceFilter === 'all') return images
    return images.filter((img) => img.source === sourceFilter)
  }, [images, sourceFilter])

  const handleLibrarySelect = useCallback(
    (image: UserImageRow) => {
      const url = originalUrls?.[image.id] ?? imageUrls[image.id]
      if (!url) return
      onSelect({ id: image.id, url, title: image.title })
      onOpenChange(false)
    },
    [imageUrls, originalUrls, onSelect, onOpenChange],
  )

  const uploadFile = useCallback(
    async (file: File) => {
      if (!onUploadToLibrary) return
      setUploading(true)
      try {
        await onUploadToLibrary(file)
      } finally {
        setUploading(false)
      }
    },
    [onUploadToLibrary],
  )

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void uploadFile(file)
      e.target.value = ''
    },
    [uploadFile],
  )

  // Paste handler — active while dialog is open
  useEffect(() => {
    if (!open || !onUploadToLibrary) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()
          e.stopPropagation()
          void uploadFile(file)
          return
        }
      }
    }
    window.addEventListener('paste', handlePaste, true)
    return () => window.removeEventListener('paste', handlePaste, true)
  }, [open, onUploadToLibrary, uploadFile])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  const filterButtons: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'upload', label: 'Uploads' },
    { value: 'ai_generated', label: 'AI Generated' },
  ]

  if (!open) return null

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />

      {/* Content */}
      <div
        ref={contentRef}
        className="fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
        style={{ width: '66vw', maxWidth: '66vw', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg leading-none font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {uploading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Select from library, or upload / paste to add images
        </p>

        <div className="flex gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setSourceFilter(btn.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                sourceFilter === btn.value
                  ? 'bg-accent-brand text-black'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading images...
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <ImageIcon className="size-8 mx-auto opacity-50" />
                <p>No images in your library yet</p>
              </div>
            </div>
          ) : (
            <ImageGrid size="md">
              {filteredImages.map((image) => (
                <Thumbnail
                  key={image.id}
                  url={imageUrls[image.id] ?? null}
                  alt={image.title}
                  onClick={() => handleLibrarySelect(image)}
                  compact
                  hoverBorder="hover:border-accent-brand/50"
                />
              ))}
            </ImageGrid>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
