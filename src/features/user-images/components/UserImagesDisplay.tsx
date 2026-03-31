/**
 * User Images Display Component
 *
 * Main container component that orchestrates the entire user images/assets feature.
 * Shows uploaded images, AI-generated images, and AI videos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, EyeOff, Info, LayoutGrid } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useUserImages } from '../hooks/useUserImages'
import { useClipboardPaste } from '../hooks/useClipboardPaste'
import { ImageUploadButton } from './ImageUploadButton'
import { ImageDownloadButton } from './ImageDownloadButton'
import { EmptyState, ImageGrid, ImageGridSkeleton } from './ImageGrid'
import { ImageCard } from './ImageCard'
import { ImageEditDialog } from './ImageEditDialog'
import type { PastedImage } from '../hooks/useClipboardPaste'
import type { SelectedFile } from './ImageUploadButton'
import type { UserImage } from '../types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { getVideoUrl, getWorkspaces } from '@/features/ai-video'
import { Thumbnail } from '@/components/Thumbnail'
import { VideoPlayerDialog } from '@/components/video-player-dialog'

type SourceFilter = 'all' | 'upload' | 'ai_generated' | 'ai_video'

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upload', label: 'Uploads' },
  { value: 'ai_generated', label: 'AI Images' },
  { value: 'ai_video', label: 'Videos' },
]

const PREFS_KEY = 'assets-view-prefs'

interface ViewPrefs {
  filter: SourceFilter
  sortAsc: boolean
  showInfo: boolean
  thumbSize: 'lg' | 'md' | 'sm'
}

const DEFAULT_PREFS: ViewPrefs = {
  filter: 'all',
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

/** A unified item that can be an image or a video */
type AssetItem =
  | { kind: 'image'; image: UserImage; imageUrl: string }
  | {
      kind: 'video'
      id: string
      label: string
      thumbnailUrl: string | null
      createdAt: string
      workspaceId: string
      generationId: string
      videoReady: boolean
    }

/**
 * User images display component
 */
interface UserImagesDisplayProps {
  deepLinkImageId?: string
}

export function UserImagesDisplay({ deepLinkImageId }: UserImagesDisplayProps) {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const {
    images,
    imageUrls,
    optimisticImages,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    error,
    createOptimistic,
    update,
    deleteImage,
    clearError,
    addOptimisticImage,
    removeOptimisticImage,
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

  // Video state
  type Workspace = {
    id: string
    name: string
    createdAt: string
    generations: Array<{
      id: string
      createdAt: string
      firstFrameUrl: string | null
      videoReady: boolean
    }>
  }
  const [workspaces, setWorkspaces] = useState<Array<Workspace>>([])
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)

  useEffect(() => {
    if (!session?.access_token) return
    getWorkspaces({ data: { accessToken: session.access_token } })
      .then(setWorkspaces)
      .catch(() => {})
  }, [session?.access_token])

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

  // Build unified asset list
  const assets = useMemo(() => {
    // Image assets
    const imageAssets: Array<AssetItem> = images
      .filter((img) => {
        if (sourceFilter === 'all') return true
        if (sourceFilter === 'ai_video') return false
        return img.source === sourceFilter
      })
      .map((img) => ({
        kind: 'image' as const,
        image: img,
        imageUrl: imageUrls[img.id] || '',
      }))

    // Video assets
    const videoAssets: Array<AssetItem> =
      sourceFilter === 'upload' || sourceFilter === 'ai_generated'
        ? []
        : workspaces.flatMap((ws) =>
            ws.generations.map((gen) => ({
              kind: 'video' as const,
              id: gen.id,
              label: ws.name,
              thumbnailUrl: gen.firstFrameUrl,
              createdAt: gen.createdAt,
              workspaceId: ws.id,
              generationId: gen.id,
              videoReady: gen.videoReady,
            })),
          )

    const combined = [...imageAssets, ...videoAssets]

    // Sort by date
    combined.sort((a, b) => {
      const dateA = a.kind === 'image' ? a.image.created_at : a.createdAt
      const dateB = b.kind === 'image' ? b.image.created_at : b.createdAt
      const diff = new Date(dateB).getTime() - new Date(dateA).getTime()
      return sortAsc ? -diff : diff
    })

    return combined
  }, [images, imageUrls, workspaces, sourceFilter, sortAsc])

  // For image-only operations (edit dialog), get filtered image list
  const imageOnlyAssets = useMemo(
    () =>
      assets.filter(
        (a): a is AssetItem & { kind: 'image' } => a.kind === 'image',
      ),
    [assets],
  )

  // Deep link: open lightbox for a specific image
  useEffect(() => {
    if (!deepLinkImageId || isLoading || deepLinkConsumed.current) return
    deepLinkConsumed.current = true

    setSourceFilter('all')

    const idx = imageOnlyAssets.findIndex((a) => a.image.id === deepLinkImageId)
    if (idx !== -1) {
      setEditingIndex(idx)
      setHighlightedImageId(deepLinkImageId)
    }

    void navigate({
      to: '/dashboard/ai-images',
      replace: true,
    })
  }, [deepLinkImageId, isLoading, imageOnlyAssets, navigate])

  const switchToVisibleFilter = useCallback(() => {
    if (sourceFilter === 'ai_generated' || sourceFilter === 'ai_video') {
      handleSourceFilter('all')
    }
  }, [sourceFilter, handleSourceFilter])

  const handleOptimisticAdd = useCallback(
    (items: Array<{ tempId: string; title: string; previewUrl: string }>) => {
      for (const item of items) {
        addOptimisticImage(item.tempId, item.title, item.previewUrl)
      }
      switchToVisibleFilter()
    },
    [addOptimisticImage, switchToVisibleFilter],
  )

  const handleOptimisticUpload = useCallback(
    async (tempId: string, file: File, title: string, previewUrl: string) => {
      try {
        await createOptimistic({ file, title, tempId, previewUrl })
      } catch {
        removeOptimisticImage(tempId)
      }
    },
    [createOptimistic, removeOptimisticImage],
  )

  // Clipboard paste
  useClipboardPaste({
    onPasteImage: useCallback(
      (pasted: PastedImage) => {
        handleOptimisticAdd([pasted])
      },
      [handleOptimisticAdd],
    ),
    onUpload: handleOptimisticUpload,
  })

  // File picker
  const handleFilesSelected = useCallback(
    (files: Array<SelectedFile>) => {
      handleOptimisticAdd(files)
    },
    [handleOptimisticAdd],
  )

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

  const handleOpenImageEdit = (imageAssetIndex: number) => {
    setEditingIndex(imageAssetIndex)
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
    if (nextIndex < imageOnlyAssets.length) {
      setEditingIndex(nextIndex)
    } else {
      setEditingIndex(0)
    }
  }

  const handlePlayVideo = async (generationId: string) => {
    if (!session?.access_token) return
    const result = await getVideoUrl({
      data: { generationId, accessToken: session.access_token },
    })
    if (result.videoUrl) {
      setActiveVideoUrl(result.videoUrl)
      setVideoDialogOpen(true)
    }
  }

  const handleVideoClick = (workspaceId: string, generationId: string) => {
    void navigate({
      to: '/dashboard/video/$workspaceId',
      params: { workspaceId },
      search: { generationId },
    })
  }

  const editingImage =
    editingIndex !== null
      ? (imageOnlyAssets[editingIndex]?.image ?? null)
      : null

  const loading = isLoading

  // Track image-only index for edit dialog mapping
  let imageIdx = -1

  const hasAiContent =
    !loading &&
    (images.some((img) => img.source === 'ai_generated') ||
      workspaces.some((ws) => ws.generations.length > 0))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Assets</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cmd+V to paste from clipboard
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ImageDownloadButton images={images} imageUrls={imageUrls} />
          <ImageUploadButton
            onFilesSelected={handleFilesSelected}
            onUploadOne={handleOptimisticUpload}
            isUploading={isCreating}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          {hasAiContent &&
            SOURCE_FILTERS.map((f) => (
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

      {/* Asset Grid or Empty State */}
      {loading ? (
        <ImageGridSkeleton size={thumbSize} />
      ) : assets.length > 0 || optimisticImages.length > 0 ? (
        <ImageGrid size={thumbSize}>
          {optimisticImages.map((opt) => (
            <div key={opt.tempId}>
              <Thumbnail
                url={opt.previewUrl}
                alt={opt.title}
                objectFit={thumbSize !== 'lg' ? 'cover' : 'contain'}
                compact={thumbSize !== 'lg'}
                imageOverlay={
                  <div className="absolute bottom-1.5 left-1.5 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded">
                    Uploading...
                  </div>
                }
              />
            </div>
          ))}
          {assets.map((asset) => {
            if (asset.kind === 'image') {
              imageIdx++
              const currentImageIdx = imageIdx
              return (
                <div key={asset.image.id} data-image-id={asset.image.id}>
                  <ImageCard
                    image={asset.image}
                    imageUrl={asset.imageUrl}
                    onClick={() => handleOpenImageEdit(currentImageIdx)}
                    onDelete={handleDelete}
                    isDeleting={isDeleting === asset.image.id}
                    isUpdating={isUpdating === asset.image.id}
                    showInfo={showInfo}
                    compact={thumbSize !== 'lg'}
                  />
                </div>
              )
            }
            // Video asset
            const compact = thumbSize !== 'lg'
            return (
              <div key={`vid-${asset.id}`}>
                <Thumbnail
                  url={asset.thumbnailUrl}
                  alt={asset.label}
                  onClick={() =>
                    handleVideoClick(asset.workspaceId, asset.generationId)
                  }
                  objectFit={compact ? 'cover' : 'contain'}
                  compact={compact}
                  asButton
                  imageOverlay={
                    <>
                      <div className="absolute bottom-1.5 left-1.5 bg-blue-600/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded">
                        Video
                      </div>
                      {asset.videoReady && (
                        <div
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handlePlayVideo(asset.generationId)
                          }}
                          className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 14 14"
                            fill="none"
                            className="ml-0.5 text-white"
                          >
                            <path
                              d="M3.5 2.5L11.5 7L3.5 11.5V2.5Z"
                              fill="currentColor"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                      {!asset.videoReady && (
                        <div className="absolute bottom-1.5 right-1.5 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                          Processing...
                        </div>
                      )}
                    </>
                  }
                  footer={
                    !compact ? (
                      <div className="flex-1 px-4 pt-3 pb-2">
                        <h3 className="text-xs font-medium text-foreground line-clamp-2">
                          {asset.label}
                        </h3>
                      </div>
                    ) : undefined
                  }
                />
              </div>
            )
          })}
        </ImageGrid>
      ) : (
        <EmptyState />
      )}

      {/* Edit Dialog (images only) */}
      <ImageEditDialog
        image={editingImage}
        imageUrl={editingImage ? imageUrls[editingImage.id] || '' : ''}
        open={editingIndex !== null}
        onClose={handleCloseEdit}
        onSave={handleUpdate}
        onNext={handleNextImage}
      />

      {/* Video Player Dialog */}
      <VideoPlayerDialog
        videoUrl={activeVideoUrl}
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
      />
    </div>
  )
}
