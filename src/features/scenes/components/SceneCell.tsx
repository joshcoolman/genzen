import { ChevronLeft, ChevronRight, RefreshCw, Wand2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { SceneCellState } from '../types'

interface SceneCellProps {
  cell: SceneCellState
  imageUrls: Record<string, string>
  onPromptChange: (prompt: string) => void
  onRegeneratePrompt: () => void
  onRun: () => void
  onSlideChange: (index: number) => void
  onOpenLightbox: (slideIndex: number) => void
  isQueued?: boolean
  disabled?: boolean
  promptsDisabled?: boolean
}

export function SceneCell({
  cell,
  imageUrls,
  onPromptChange,
  onRegeneratePrompt,
  onRun,
  onSlideChange,
  onOpenLightbox,
  isQueued,
  disabled,
  promptsDisabled,
}: SceneCellProps) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const latestGenIndex = cell.currentSlideIndex
  const latestGen = cell.generations[latestGenIndex] as SavedAiImage | undefined
  const isPending = cell.pendingId !== null
  const isPendingOrQueued = isPending || !!isQueued
  const completedGens = cell.generations.filter((g) => g.status === 'completed')
  const showSlideshow = completedGens.length > 1

  const currentUrl =
    latestGen?.status === 'completed' ? imageUrls[latestGen.id] : undefined

  const currentCompletedIndex = completedGens.findIndex(
    (g) => g.id === (latestGen ? latestGen.id : ''),
  )
  const totalCompleted = completedGens.length

  const isFailed = !isPending && latestGen?.status === 'failed'

  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) setImgLoaded(true)
    },
    [currentUrl],
  )

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header: cell number + regen prompt button + slideshow nav */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {Number(cell.id) + 1}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onRegeneratePrompt()
          }}
          disabled={promptsDisabled}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors shrink-0"
          title="Regenerate prompt for this cell"
        >
          <Wand2 className="h-3 w-3" />
        </button>

        {showSlideshow && (
          <div className="flex items-center gap-0.5 shrink-0 ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const prev = completedGens[currentCompletedIndex - 1] as
                  | SavedAiImage
                  | undefined
                if (prev) {
                  const idx = cell.generations.findIndex(
                    (g) => g.id === prev.id,
                  )
                  if (idx !== -1) onSlideChange(idx)
                }
              }}
              disabled={currentCompletedIndex <= 0}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {currentCompletedIndex + 1}/{totalCompleted}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const next = completedGens[currentCompletedIndex + 1] as
                  | SavedAiImage
                  | undefined
                if (next) {
                  const idx = cell.generations.findIndex(
                    (g) => g.id === next.id,
                  )
                  if (idx !== -1) onSlideChange(idx)
                }
              }}
              disabled={currentCompletedIndex >= totalCompleted - 1}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Prompt textarea */}
      <div className="px-2 pb-1">
        <textarea
          value={cell.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Prompt..."
          rows={2}
          className="w-full resize-none rounded border border-border bg-transparent px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
      </div>

      {/* Preview — square */}
      <div
        className={`relative aspect-square w-full bg-black ${currentUrl ? 'cursor-pointer' : ''}`}
        onClick={
          currentUrl ? () => onOpenLightbox(cell.currentSlideIndex) : undefined
        }
      >
        {isPendingOrQueued ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className={`size-5 animate-spin rounded-full border-2 border-border border-t-accent-brand ${isQueued ? 'opacity-40' : ''}`}
            />
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs text-destructive">Failed</span>
          </div>
        ) : currentUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-muted/30" />
            )}
            <img
              ref={imgRef}
              src={currentUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              className={`h-full w-full object-contain p-2 transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        ) : (
          <div className="h-full w-full" />
        )}
      </div>

      {/* Footer: rerun button */}
      <div className="flex items-center px-2 py-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRun()
          }}
          disabled={disabled || isPending || !cell.prompt.trim()}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          title="Generate image for this cell"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
