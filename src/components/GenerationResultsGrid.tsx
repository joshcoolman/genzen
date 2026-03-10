import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Info,
  LayoutGrid,
  Plus,
} from 'lucide-react'
import type { GenerationResult } from '@/lib/types/generation-result'
import type { LightboxImage } from '@/components/Lightbox'
import { Lightbox } from '@/components/Lightbox'
import { ImageResultCard } from '@/components/ImageResultCard'
import { ImageGrid } from '@/components/ImageGrid'

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function GenerationResultCard({
  result,
  selected,
  onOpen,
  onDelete,
  onAdd,
  showFooter,
  compact,
}: {
  result: GenerationResult
  selected?: boolean
  onOpen: () => void
  onDelete: () => void
  onAdd?: () => void
  showFooter?: boolean
  compact?: boolean
}) {
  return (
    <ImageResultCard
      url={result.url ?? undefined}
      alt={result.title ?? result.label}
      status={result.status}
      pendingLabel={result.label}
      failedMessage={result.label}
      selected={selected}
      compact={compact}
      onClick={onOpen}
      onDelete={onDelete}
      overlayActions={
        onAdd && result.status === 'complete' && result.url ? (
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
        ) : undefined
      }
      footer={
        showFooter && result.title ? (
          <>
            <div className="flex-1 px-4 pt-3 pb-2">
              <h3 className="text-xs font-medium text-foreground line-clamp-2">
                {result.title}
              </h3>
            </div>
            {(result.fileSize || result.createdAt) && (
              <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>
                    {result.fileSize ? formatFileSize(result.fileSize) : ''}
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
  selectedId?: string | null
  title?: string
  prefsKey?: string
}

export function GenerationResultsGrid({
  results,
  onDelete,
  onSelect,
  onAdd,
  selectedId,
  title = 'Results',
  prefsKey,
}: GenerationResultsGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
    () => (sortAsc ? [...results].reverse() : results),
    [results, sortAsc],
  )

  const compact = thumbSize !== 'lg'
  const showFooter = showInfo && !compact

  if (results.length === 0) return null

  const completeResults = displayResults.filter(
    (r) => r.status === 'complete' && r.url,
  )

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

      <ImageGrid size={thumbSize}>
        {displayResults.map((result) => (
          <GenerationResultCard
            key={result.id}
            result={result}
            selected={selectedId === result.id}
            showFooter={showFooter}
            compact={compact}
            onOpen={() => (onSelect ? onSelect(result.id) : handleOpen(result))}
            onDelete={() => onDelete(result.id)}
            onAdd={onAdd ? () => onAdd(result) : undefined}
          />
        ))}
      </ImageGrid>

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={imageUrls}
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
