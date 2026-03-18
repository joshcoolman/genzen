import { useState } from 'react'
import { ArrowDown, ArrowUp, EyeOff, Info, LayoutGrid } from 'lucide-react'
import type { GenerationRecord } from '../types'
import { Thumbnail } from '@/components/Thumbnail'
import { ImageGrid } from '@/components/ImageGrid'
import { VideoPlayerDialog } from '@/components/video-player-dialog'

const PREFS_KEY = 'multishot-history-prefs'
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

function getStoredPrefs(): GridPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (stored)
      return { ...DEFAULT_PREFS, ...(JSON.parse(stored) as Partial<GridPrefs>) }
  } catch {}
  return DEFAULT_PREFS
}

function storePrefs(update: Partial<GridPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...update }))
  } catch {}
}

interface GenerationHistoryProps {
  generations: Array<GenerationRecord>
  loading: boolean
  onDelete?: (id: string) => void
}

export function GenerationHistory({
  generations,
  loading,
  onDelete,
}: GenerationHistoryProps) {
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [storedPrefs] = useState(getStoredPrefs)
  const [sortAsc, setSortAsc] = useState(storedPrefs.sortAsc)
  const [showInfo, setShowInfo] = useState(storedPrefs.showInfo)
  const [thumbSize, setThumbSize] = useState<'lg' | 'md' | 'sm'>(
    storedPrefs.thumbSize,
  )

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="text-xs text-muted-foreground">
          Loading history...
        </span>
      </div>
    )
  }

  if (generations.length === 0) {
    return null
  }

  const compact = thumbSize !== 'lg'
  const showFooter = showInfo && !compact
  const displayGenerations = sortAsc ? [...generations].reverse() : generations

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Generation History</h3>
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
        {displayGenerations.map((gen) => {
          const timeStr = new Date(gen.createdAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })

          const status =
            gen.status === 'completed'
              ? ('complete' as const)
              : gen.status === 'pending' || gen.status === 'processing'
                ? ('pending' as const)
                : ('failed' as const)

          return (
            <Thumbnail
              key={gen.id}
              status={status}
              objectFit="cover"
              compact={compact}
              pendingLabel={gen.status}
              failedMessage={gen.error || undefined}
              label={compact ? timeStr : undefined}
              onClick={
                gen.videoUrl ? () => setPlayingUrl(gen.videoUrl) : undefined
              }
              fallback={
                gen.videoUrl ? (
                  <video
                    src={gen.videoUrl}
                    muted
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : undefined
              }
              onDelete={onDelete ? () => onDelete(gen.id) : undefined}
              imageOverlay={gen.videoUrl ? <VideoPlayOverlay /> : undefined}
              footer={
                showFooter ? (
                  <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    <div className="flex justify-between items-center">
                      <span>{timeStr}</span>
                      <span className="capitalize">{gen.status}</span>
                    </div>
                  </div>
                ) : undefined
              }
            />
          )
        })}
      </ImageGrid>

      <VideoPlayerDialog
        videoUrl={playingUrl}
        open={!!playingUrl}
        onOpenChange={(open) => {
          if (!open) setPlayingUrl(null)
        }}
      />
    </div>
  )
}

function VideoPlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
        <svg
          width="12"
          height="12"
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
    </div>
  )
}
