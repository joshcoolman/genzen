import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { ImageModel } from '@/features/ai-images/models'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { ModelCellState } from '../types'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ModelPickerButton } from '@/components/ModelPickerButton'

interface ModelShotCellProps {
  cell: ModelCellState
  imageUrls: Record<string, string>
  onToggleEnabled: () => void
  onModelChange: (model: ImageModel) => void
  onRun: () => void
  onSlideChange: (index: number) => void
  onOpenLightbox: (slideIndex: number) => void
  disabled?: boolean
}

export function ModelShotCell({
  cell,
  imageUrls,
  onToggleEnabled,
  onModelChange,
  onRun,
  onSlideChange,
  onOpenLightbox,
  disabled,
}: ModelShotCellProps) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const latestGenIndex = cell.currentSlideIndex
  const latestGen = cell.generations[latestGenIndex] as SavedAiImage | undefined
  const isPending = cell.pendingId !== null
  const showSlideshow =
    cell.generations.filter((g) => g.status === 'completed').length > 1

  const currentUrl =
    latestGen?.status === 'completed' ? imageUrls[latestGen.id] : undefined

  const completedGens = cell.generations.filter((g) => g.status === 'completed')
  const currentCompletedIndex = completedGens.findIndex(
    (g) => g.id === (latestGen ? latestGen.id : ''),
  )
  const totalCompleted = completedGens.length

  const isFailed = !isPending && latestGen?.status === 'failed'

  // Reset load state when URL changes
  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) setImgLoaded(true)
    },
    [currentUrl],
  )

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-opacity ${
        cell.isEnabled ? '' : 'opacity-50'
      }`}
    >
      {/* Header: toggle + model name + slideshow counter */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleEnabled()
          }}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors ${
            cell.isEnabled
              ? 'bg-green-500/80 text-white'
              : 'bg-muted/60 text-muted-foreground'
          }`}
          title={
            cell.isEnabled
              ? 'Enabled — click to disable'
              : 'Disabled — click to enable'
          }
        >
          <span className="text-[9px] font-bold">
            {cell.isEnabled ? '✓' : '○'}
          </span>
        </button>

        <ModelPickerButton
          models={ALL_IMAGE_MODELS}
          selectedId={cell.model.id}
          onSelect={(id) => {
            const m = ALL_IMAGE_MODELS.find((model) => model.id === id)
            if (m) onModelChange(m)
          }}
        />

        {showSlideshow && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const prev = completedGens[
                  currentCompletedIndex - 1
                ] as SavedAiImage | undefined
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
                const next = completedGens[
                  currentCompletedIndex + 1
                ] as SavedAiImage | undefined
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

      {/* Preview — square, flush edge-to-edge */}
      <div
        className={`relative aspect-square w-full bg-black ${
          currentUrl ? 'cursor-pointer' : ''
        }`}
        onClick={
          currentUrl ? () => onOpenLightbox(cell.currentSlideIndex) : undefined
        }
      >
        {isPending ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
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
              className={`h-full w-full object-contain p-2 transition-opacity duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
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
          disabled={disabled || isPending || !cell.isEnabled}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          title="Re-run this cell"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
