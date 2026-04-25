import {
  AlertCircle,
  CheckCircle2,
  Clock4,
  Film,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import type { ActivityEntry } from '../types'
import {
  formatAbsolute,
  formatDurationMs,
  formatRelativeOrDate,
} from '@/lib/time-format'
import { cn } from '@/lib/utils'

interface ActivityRowProps {
  entry: ActivityEntry
  thumbnailUrl: string | null
  onSelect?: (id: string) => void
}

function StatusIndicator({ status }: { status: ActivityEntry['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="text-[11px]">Completed</span>
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="text-[11px]">Failed</span>
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-[11px]">Processing</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Clock4 className="h-3.5 w-3.5" />
      <span className="text-[11px]">Pending</span>
    </span>
  )
}

function formatCents(cents: number | null): string {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`
  if (dollars < 1) return `$${dollars.toFixed(3)}`
  return `$${dollars.toFixed(2)}`
}

export function ActivityRow({
  entry,
  thumbnailUrl,
  onSelect,
}: ActivityRowProps) {
  const duration =
    entry.durationMs != null ? formatDurationMs(entry.durationMs) : '—'
  const KindIcon = entry.kind === 'video' ? Film : ImageIcon

  return (
    <button
      type="button"
      onClick={() => onSelect?.(entry.id)}
      className={cn(
        'grid w-full grid-cols-[48px_minmax(0,1.2fr)_minmax(0,2fr)_110px_80px_80px_90px_minmax(130px,_auto)] items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        entry.isDeleted && 'opacity-60',
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-black">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/50">
            <KindIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {entry.kind === 'video' && thumbnailUrl && (
          <div className="absolute bottom-0.5 right-0.5 rounded bg-background/80 px-1 py-0.5">
            <Film className="h-2.5 w-2.5 text-foreground" />
          </div>
        )}
      </div>

      {/* Model + deleted badge */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {entry.modelName}
        </span>
        {entry.isDeleted && (
          <span className="inline-flex w-fit items-center rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            deleted
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="min-w-0">
        <p
          className="truncate text-xs text-muted-foreground"
          title={entry.prompt || undefined}
        >
          {entry.prompt || <span className="italic">No prompt</span>}
        </p>
        {entry.status === 'failed' && entry.errorMessage && (
          <p
            className="mt-0.5 truncate text-[11px] text-destructive/80"
            title={entry.errorMessage}
          >
            {entry.errorMessage}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="min-w-0">
        <StatusIndicator status={entry.status} />
      </div>

      {/* Duration */}
      <div className="text-xs tabular-nums text-muted-foreground">
        {duration}
      </div>

      {/* User cost */}
      <div
        className="text-xs tabular-nums text-foreground"
        title="What you paid (credits × $/credit)"
      >
        {formatCents(entry.userCostCents)}
      </div>

      {/* Provider cost */}
      <div
        className="text-xs tabular-nums text-muted-foreground"
        title="Raw provider cost"
      >
        {formatCents(entry.providerCostCents)}
      </div>

      {/* Time */}
      <div
        className="text-right text-xs text-muted-foreground"
        title={formatAbsolute(entry.createdAt)}
      >
        {formatRelativeOrDate(entry.createdAt)}
      </div>
    </button>
  )
}
