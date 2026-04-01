import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Info,
  LayoutGrid,
  Maximize2,
  Plus,
  RefreshCw,
  Unlink,
} from 'lucide-react'
import type { GenerationResult } from '@/lib/types/generation-result'
import type { LightboxImage } from '@/components/Lightbox'
import { Lightbox } from '@/components/Lightbox'
import { createImageStorage } from '@/lib/image-storage'
import { Thumbnail } from '@/components/Thumbnail'
import { ImageGrid } from '@/components/ImageGrid'
import { ExpandableText } from '@/components/ExpandableText'
import { formatFileSize } from '@/lib/format'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface GridPrefs {
  sortAsc: boolean
  showInfo: boolean
  thumbSize: 'lg' | 'md' | 'sm'
}

const DEFAULT_PREFS: GridPrefs = {
  sortAsc: false,
  showInfo: true,
  thumbSize: 'lg',
}

function getStoredPrefs(key?: string): GridPrefs {
  if (!key) return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<GridPrefs>
      return { ...DEFAULT_PREFS, ...parsed }
    }
  } catch {}
  return DEFAULT_PREFS
}

function storePrefs(key: string | undefined, update: Partial<GridPrefs>) {
  if (!key) return
  try {
    const current = getStoredPrefs(key)
    localStorage.setItem(key, JSON.stringify({ ...current, ...update }))
  } catch {}
}

function RegenerateButton({
  result,
  models,
  onRegenerate,
}: {
  result: GenerationResult
  models: Array<{ id: string; name: string }>
  onRegenerate: (result: GenerationResult, modelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation()
          }}
          className="absolute bottom-1.5 right-1.5 z-10 rounded-full bg-background/80 backdrop-blur-sm p-1.5 text-muted-foreground hover:text-foreground transition-all"
          aria-label="Regenerate with different model"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1"
        side="top"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          Regenerate with
        </div>
        {models.map((m) => (
          <button
            key={m.id}
            onClick={(e) => {
              e.stopPropagation()
              onRegenerate(result, m.id)
              setOpen(false)
            }}
            className="w-full text-left text-sm px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {m.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function GenerationResultCard({
  result,
  selected,
  selectedClassName,
  onOpen,
  onDelete,
  onAdd,
  onExpand,
  onDetach,
  onRegenerate,
  onAddPrompt,
  regenerateModels,
  showFooter,
  compact,
  editMode,
}: {
  result: GenerationResult
  selected?: boolean
  selectedClassName?: string
  onOpen: () => void
  onDelete: () => void
  onAdd?: () => void
  onExpand?: () => void
  onDetach?: () => void
  onRegenerate?: (result: GenerationResult, modelId: string) => void
  onAddPrompt?: (text: string) => void
  regenerateModels?: Array<{ id: string; name: string }>
  showFooter?: boolean
  compact?: boolean
  editMode?: boolean
}) {
  return (
    <Thumbnail
      url={result.url ?? undefined}
      alt={result.title ?? result.label}
      status={result.status}
      pendingLabel={result.label}
      failedMessage={result.label}
      selected={selected}
      selectedClassName={selectedClassName}
      compact={compact}
      onClick={onOpen}
      onDelete={onDelete}
      imageOverlay={
        <>
          {/* Regenerate button — hidden in edit mode */}
          {!editMode &&
          onRegenerate &&
          regenerateModels &&
          result.status === 'complete' &&
          result.url &&
          result.prompt ? (
            <RegenerateButton
              result={result}
              models={regenerateModels}
              onRegenerate={onRegenerate}
            />
          ) : undefined}
          {/* Expand icon to open lightbox when card click is hijacked by onSelect */}
          {onExpand && result.status === 'complete' && result.url && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExpand()
              }}
              className="absolute bottom-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all"
              aria-label="View full size"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      }
      overlayActions={
        result.status === 'complete' && result.url ? (
          <>
            {onDetach && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDetach()
                }}
                className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all"
                aria-label="Detach"
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            )}
            {!editMode && onAdd && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
                className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all"
                aria-label="Use as source"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : undefined
      }
      footer={
        showFooter ? (
          <>
            {(result.title ?? result.prompt) && (
              <div className="flex-1 px-4 pt-3 pb-2">
                <h3 className="text-xs font-medium text-foreground line-clamp-2">
                  {result.title ?? result.prompt}
                </h3>
              </div>
            )}
            {result.status !== 'pending' &&
              result.prompt &&
              !result.enhancedPrompt && (
                <ExpandableText
                  text={result.prompt}
                  onAddPrompt={onAddPrompt}
                />
              )}
            {result.enhancedPrompt && (
              <div className="px-4 pt-2 pb-1">
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {result.enhancedPrompt}
                </p>
                {result.originalPrompt && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">
                    Original: {result.originalPrompt}
                  </p>
                )}
              </div>
            )}
            {(result.fileSize ||
              result.createdAt ||
              result.status === 'pending') && (
              <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>
                    {result.fileSize
                      ? formatFileSize(result.fileSize)
                      : result.status === 'pending'
                        ? '-'
                        : ''}
                  </span>
                  <span>
                    {result.createdAt
                      ? new Date(result.createdAt).toLocaleDateString()
                      : ''}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : undefined
      }
    />
  )
}

interface GenerationResultsGridProps {
  results: Array<GenerationResult>
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
  onAdd?: (result: GenerationResult) => void
  onDetach?: (id: string) => void
  onRegenerate?: (result: GenerationResult, modelId: string) => void
  onAddPrompt?: (text: string) => void
  regenerateModels?: Array<{ id: string; name: string }>
  selectedId?: string | null
  selectedClassName?: string
  title?: string
  prefsKey?: string
  editMode?: boolean
}

export function GenerationResultsGrid({
  results,
  onDelete,
  onSelect,
  onAdd,
  onDetach,
  onRegenerate,
  onAddPrompt,
  regenerateModels,
  selectedId,
  selectedClassName,
  title = 'Results',
  prefsKey,
  editMode,
}: GenerationResultsGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [fullResUrls, setFullResUrls] = useState<Record<string, string>>({})
  const fetchingRef = useRef<Set<string>>(new Set())

  const [storedPrefs] = useState(() => getStoredPrefs(prefsKey))
  const [sortAsc, setSortAsc] = useState(storedPrefs.sortAsc)
  const [showInfo, setShowInfo] = useState(storedPrefs.showInfo)
  const [thumbSize, setThumbSize] = useState<'lg' | 'md' | 'sm'>(
    storedPrefs.thumbSize,
  )

  const handleToggleSort = () => {
    setSortAsc((v) => {
      storePrefs(prefsKey, { sortAsc: !v })
      return !v
    })
  }

  const handleToggleInfo = () => {
    setShowInfo((v) => {
      storePrefs(prefsKey, { showInfo: !v })
      return !v
    })
  }

  const handleToggleThumbSize = () => {
    setThumbSize((v) => {
      const idx = THUMB_SIZES.indexOf(v)
      const next = THUMB_SIZES[(idx + 1) % THUMB_SIZES.length]
      storePrefs(prefsKey, { thumbSize: next })
      return next
    })
  }

  const displayResults = useMemo(
    () => (editMode ? results : sortAsc ? [...results].reverse() : results),
    [results, sortAsc, editMode],
  )

  const compact = thumbSize !== 'lg'
  const showFooter = showInfo && !compact

  if (results.length === 0) return null

  const completeResults = displayResults.filter(
    (r) => r.status === 'complete' && r.url,
  )

  // Fetch full-res URLs on demand when lightbox opens/navigates
  useEffect(() => {
    if (lightboxIndex === null) return
    const indices = [
      lightboxIndex,
      lightboxIndex - 1,
      lightboxIndex + 1,
    ].filter((i) => i >= 0 && i < completeResults.length)
    for (const i of indices) {
      const r = completeResults[i]
      if (!r.storagePath || fullResUrls[r.id] || fetchingRef.current.has(r.id))
        continue
      fetchingRef.current.add(r.id)
      createImageStorage()
        .getUrl(r.storagePath)
        .then((url) => {
          if (url) {
            setFullResUrls((prev) => ({ ...prev, [r.id]: url }))
          }
        })
        .catch(() => {})
        .finally(() => fetchingRef.current.delete(r.id))
    }
  }, [lightboxIndex, completeResults, fullResUrls])

  const lightboxImages: Array<LightboxImage> = completeResults.map((r) => ({
    id: r.id,
    url: r.url ?? '',
    title: r.title ?? r.label,
  }))

  const imageUrls: Record<string, string> = {}
  for (const r of completeResults) {
    if (r.url) imageUrls[r.id] = r.url
  }

  function getCompleteIndex(result: GenerationResult): number {
    return completeResults.findIndex((r) => r.id === result.id)
  }

  function handleOpen(result: GenerationResult) {
    const idx = getCompleteIndex(result)
    if (idx >= 0) setLightboxIndex(idx)
  }

  function handleLightboxDelete() {
    if (lightboxIndex === null) return
    const toDelete = completeResults[lightboxIndex]
    onDelete(toDelete.id)
    if (completeResults.length <= 1) {
      setLightboxIndex(null)
    } else if (lightboxIndex >= completeResults.length - 1) {
      setLightboxIndex(lightboxIndex - 1)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
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
          {!editMode && (
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
          )}
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

      <ImageGrid size={thumbSize}>
        {displayResults.map((result) => (
          <GenerationResultCard
            key={result.id}
            result={result}
            selected={selectedId === result.id}
            selectedClassName={selectedClassName}
            showFooter={showFooter}
            compact={compact}
            editMode={editMode}
            onOpen={() => (onSelect ? onSelect(result.id) : handleOpen(result))}
            onDelete={() => onDelete(result.id)}
            onAdd={onAdd ? () => onAdd(result) : undefined}
            onExpand={onSelect ? () => handleOpen(result) : undefined}
            onDetach={onDetach ? () => onDetach(result.id) : undefined}
            onRegenerate={onRegenerate}
            onAddPrompt={onAddPrompt}
            regenerateModels={regenerateModels}
          />
        ))}
      </ImageGrid>

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={imageUrls}
          fullResUrls={fullResUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i === null ? 0 : (i + 1) % lightboxImages.length,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) =>
              i === null
                ? 0
                : (i - 1 + lightboxImages.length) % lightboxImages.length,
            )
          }
          onDelete={handleLightboxDelete}
        />
      )}
    </div>
  )
}
