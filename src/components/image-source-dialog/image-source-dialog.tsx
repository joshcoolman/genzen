'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { Thumbnail } from '../thumbnail/thumbnail'
import { ImageGrid } from '../image-grid/image-grid'
import styles from './image-source-dialog.module.css'
import { cx } from '#/lib/utils'

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
      <div className={styles.overlay} onClick={() => onOpenChange(false)} />

      {/* Content */}
      <div
        ref={contentRef}
        className={styles.content}
        style={{ width: '66vw', maxWidth: '66vw', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {uploading && <Loader2 className={styles.uploadSpinner} />}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.fileInput}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={styles.upload}
            >
              <Upload className={styles.uploadIcon} />
              Upload
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className={styles.close}
            >
              <X className={styles.closeIcon} />
              <span className={styles.srOnly}>Close</span>
            </button>
          </div>
        </div>

        <p className={styles.hint}>
          Select from library, or upload / paste to add images
        </p>

        <div className={styles.filters}>
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setSourceFilter(btn.value)}
              className={cx(
                styles.filter,
                sourceFilter === btn.value && styles.filterActive,
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.placeholder}>Loading images...</div>
          ) : filteredImages.length === 0 ? (
            <div className={styles.placeholder}>
              <div className={styles.empty}>
                <ImageIcon className={styles.emptyIcon} />
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
                  pickable
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
