/**
 * User Images Display Component
 *
 * Main container component that orchestrates the entire user images feature.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, EyeOff, Info, LayoutGrid } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useUserImages } from '../hooks/useUserImages'
import { useClipboardPaste } from '../hooks/useClipboardPaste'
import { ImageUploadButton } from './ImageUploadButton'
import { ImageDownloadButton } from './ImageDownloadButton'
import { EmptyState, ImageGrid } from './ImageGrid'
import { ImageCard } from './ImageCard'
import { ImageEditDialog } from './ImageEditDialog'
import type { CreateUserImageInput } from '../types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

type SourceFilter = 'all' | 'upload' | 'ai_generated'

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upload', label: 'Uploads' },
  { value: 'ai_generated', label: 'AI Images' },
]

const PREFS_KEY = 'uploads-view-prefs'

interface ViewPrefs {
  filter: SourceFilter
  sortAsc: boolean
  showInfo: boolean
  thumbSize: 'lg' | 'md' | 'sm'
}

const DEFAULT_PREFS: ViewPrefs = {
  filter: 'upload',
  sortAsc: false,
  showInfo: true,
  thumbSize: 'lg',
}

const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

function getStoredPrefs(): ViewPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ViewPrefs>
      return { ...DEFAULT_PREFS, ...parsed }
    }
  } catch {}
  return DEFAULT_PREFS
}

function storePrefs(update: Partial<ViewPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...update }))
  } catch {}
}

/**
 * User images display component
 */
interface UserImagesDisplayProps {
  deepLinkImageId?: string
}

export function UserImagesDisplay({ deepLinkImageId }: UserImagesDisplayProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    images,
    imageUrls,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    error,
    create,
    update,
    deleteImage,
    clearError,
  } = useUserImages(user?.id)

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [highlightedImageId, setHighlightedImageId] = useState<string | null>(
    null,
  )
  const deepLinkConsumed = useRef(false)

  const [storedPrefs] = useState(getStoredPrefs)
  const [sortAsc, setSortAsc] = useState(storedPrefs.sortAsc)
  const [showInfo, setShowInfo] = useState(storedPrefs.showInfo)
  const [thumbSize, setThumbSize] = useState<'lg' | 'md' | 'sm'>(
    storedPrefs.thumbSize,
  )
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
    storedPrefs.filter,
  )

  const handleSourceFilter = (filter: SourceFilter) => {
    setSourceFilter(filter)
    storePrefs({ filter })
  }

  const handleToggleSort = () => {
    setSortAsc((v) => {
      storePrefs({ sortAsc: !v })
      return !v
    })
  }

  const handleToggleInfo = () => {
    setShowInfo((v) => {
      storePrefs({ showInfo: !v })
      return !v
    })
  }

  const handleToggleThumbSize = () => {
    setThumbSize((v) => {
      const idx = THUMB_SIZES.indexOf(v)
      const next = THUMB_SIZES[(idx + 1) % THUMB_SIZES.length]
      storePrefs({ thumbSize: next })
      return next
    })
  }

  const sortedImages = useMemo(() => {
    let result =
      sourceFilter === 'all'
        ? images
        : images.filter((img) => img.source === sourceFilter)
    if (sortAsc) result = [...result].reverse()
    return result
  }, [images, sortAsc, sourceFilter])

  // Deep link: open lightbox for a specific image when navigating from Everything
  useEffect(() => {
    if (!deepLinkImageId || isLoading || deepLinkConsumed.current) return
    deepLinkConsumed.current = true

    // Switch to 'all' filter (state only, don't persist to localStorage)
    setSourceFilter('all')

    // Find the image in the full (unsorted) images list with 'all' filter
    const allImages = sortAsc ? [...images].reverse() : images
    const idx = allImages.findIndex((img) => img.id === deepLinkImageId)
    if (idx !== -1) {
      setEditingIndex(idx)
      setHighlightedImageId(deepLinkImageId)
    }

    // Clear the URL param so refresh doesn't re-trigger
    void navigate({
      to: '/dashboard/images',
      search: { imageId: undefined },
      replace: true,
    })
  }, [deepLinkImageId, isLoading, images, sortAsc, navigate])

  const handleUpload = async (input: CreateUserImageInput) => {
    await create(input)
  }

  useClipboardPaste({ onUpload: handleUpload, enabled: !isCreating })

  const handleUpdate = async (
    id: string,
    title: string,
    description: string | null,
  ) => {
    await update(id, title, description)
  }

  const handleDelete = (id: string) => {
    deleteImage(id)
  }

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index)
  }

  const handleCloseEdit = () => {
    setEditingIndex(null)

    if (highlightedImageId) {
      const id = highlightedImageId
      setHighlightedImageId(null)
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-image-id="${id}"]`)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          el.classList.add('ring-2', 'ring-primary')
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-primary')
          }, 2000)
        }
      })
    }
  }

  const handleNextImage = () => {
    if (editingIndex === null) return
    const nextIndex = editingIndex + 1
    if (nextIndex < sortedImages.length) {
      setEditingIndex(nextIndex)
    } else {
      setEditingIndex(0)
    }
  }

  const editingImage =
    editingIndex !== null ? (sortedImages[editingIndex] ?? null) : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-4 text-2xl text-muted-foreground">Loading...</div>
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Uploads</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cmd+V to paste from clipboard
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ImageDownloadButton images={images} imageUrls={imageUrls} />
          <ImageUploadButton onUpload={handleUpload} isUploading={isCreating} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleSourceFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                sourceFilter === f.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleThumbSize}
            className="flex w-14 items-center justify-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={`Thumbnail size: ${THUMB_LABELS[thumbSize]}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">
              {THUMB_LABELS[thumbSize]}
            </span>
          </button>
          <button
            onClick={handleToggleSort}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={sortAsc ? 'Sort newest first' : 'Sort oldest first'}
          >
            {sortAsc ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleToggleInfo}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={showInfo ? 'Hide info' : 'Show info'}
          >
            {showInfo ? (
              <Info className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-sm underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Image Grid or Empty State */}
      {sortedImages.length > 0 ? (
        <ImageGrid size={thumbSize}>
          {sortedImages.map((image, index) => (
            <div key={image.id} data-image-id={image.id}>
              <ImageCard
                image={image}
                imageUrl={imageUrls[image.id] || ''}
                onClick={() => handleOpenEdit(index)}
                onDelete={handleDelete}
                isDeleting={isDeleting === image.id}
                isUpdating={isUpdating === image.id}
                showInfo={showInfo}
                compact={thumbSize !== 'lg'}
              />
            </div>
          ))}
        </ImageGrid>
      ) : (
        <EmptyState />
      )}

      {/* Edit Dialog */}
      <ImageEditDialog
        image={editingImage}
        imageUrl={editingImage ? imageUrls[editingImage.id] || '' : ''}
        open={editingIndex !== null}
        onClose={handleCloseEdit}
        onSave={handleUpdate}
        onNext={handleNextImage}
        userId={user?.id || ''}
      />
    </div>
  )
}
