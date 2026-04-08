import { Copy, RotateCcw } from 'lucide-react'
import type { HistoryEntry } from '../types'

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface HistoryCardProps {
  entry: HistoryEntry
  onCopyPrompt: (prompt: string) => void
  onUseAgain: (prompt: string) => void
}

export function HistoryCardGrid({
  entry,
  onCopyPrompt,
  onUseAgain,
}: HistoryCardProps) {
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card">
      {/* Thumbnail */}
      <div className="relative aspect-square w-full bg-black">
        {entry.thumbnailUrl ? (
          <img
            src={entry.thumbnailUrl}
            alt={entry.prompt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/50">
            <span className="text-xs text-muted-foreground">No image</span>
          </div>
        )}
        {/* Date badge */}
        <span className="absolute right-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
          {formatDateTime(entry.createdAt)}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-2.5">
        <p className="truncate text-xs font-medium text-foreground">
          {entry.modelName}
        </p>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {entry.prompt || 'No prompt'}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onCopyPrompt(entry.prompt)}
            className="flex h-6 items-center gap-1 rounded border border-input bg-background px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            title="Copy prompt"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <button
            onClick={() => onUseAgain(entry.prompt)}
            className="flex h-6 items-center gap-1 rounded border border-input bg-background px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            title="Use this prompt again"
          >
            <RotateCcw className="h-3 w-3" />
            Use again
          </button>
        </div>
      </div>
    </div>
  )
}

export function HistoryCardList({
  entry,
  onCopyPrompt,
  onUseAgain,
}: HistoryCardProps) {
  return (
    <div className="group flex items-center gap-4 rounded-lg border border-border bg-card p-2">
      {/* Thumbnail */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-black">
        {entry.thumbnailUrl ? (
          <img
            src={entry.thumbnailUrl}
            alt={entry.prompt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/50" />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {entry.modelName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.prompt || 'No prompt'}
        </p>
      </div>

      {/* Date badge */}
      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        {formatDateTime(entry.createdAt)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onCopyPrompt(entry.prompt)}
          className="flex h-7 w-7 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:text-foreground"
          title="Copy prompt"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onUseAgain(entry.prompt)}
          className="flex h-7 w-7 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:text-foreground"
          title="Use again"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
