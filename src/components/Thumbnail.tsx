import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

export interface ThumbnailProps {
  url?: string | null
  alt?: string
  status?: 'pending' | 'complete' | 'failed'

  pendingLabel?: string
  pendingBackgroundUrl?: string

  failedMessage?: string

  label?: string
  topLeftBadge?: string

  onDelete?: () => void
  overlayActions?: ReactNode
  overlayActionsLeft?: ReactNode

  onClick?: () => void

  selected?: boolean

  alwaysShowOverlay?: boolean
  compact?: boolean
  dimmed?: boolean
  hoverBorder?: string
  objectFit?: 'contain' | 'cover'
  asButton?: boolean
  fallback?: ReactNode
  footer?: ReactNode
  imageOverlay?: ReactNode
  layout?: 'grid' | 'list'
  className?: string

  children?: ReactNode
}

export function Thumbnail({
  url,
  alt,
  status = 'complete',
  pendingLabel,
  pendingBackgroundUrl,
  failedMessage,
  label,
  topLeftBadge,
  onDelete,
  overlayActions,
  overlayActionsLeft,
  onClick,
  selected,
  alwaysShowOverlay = false,
  compact = false,
  dimmed = false,
  hoverBorder,
  objectFit = 'contain',
  asButton = false,
  fallback,
  footer,
  imageOverlay,
  layout = 'grid',
  className,
  children,
}: ThumbnailProps) {
  const El = asButton ? 'button' : 'div'
  const bgClass = objectFit === 'contain' ? 'bg-black p-2.5' : ''
  const cursorClass = onClick ? 'cursor-pointer' : ''

  // List layout: horizontal row
  if (layout === 'list') {
    return (
      <El
        className={`group flex items-center gap-4 overflow-hidden border border-border bg-card rounded-lg p-2 transition-opacity ${cursorClass} ${hoverBorder ?? ''} ${dimmed ? 'opacity-50' : ''} ${className ?? ''}`}
        onClick={onClick}
      >
        <div
          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md ${bgClass}`}
        >
          {url ? (
            <img
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={`h-full w-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            />
          ) : (
            (fallback ?? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                ...
              </div>
            ))
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">{footer}</div>
        {children}
      </El>
    )
  }

  // Grid layout
  const rounding = compact ? 'rounded-md' : 'rounded-lg'

  return (
    <El
      className={`group relative overflow-hidden ${rounding} border bg-card flex flex-col ${
        selected
          ? 'border-primary ring-1 ring-primary'
          : `border-border ${hoverBorder ?? ''}`
      } ${dimmed ? 'opacity-50' : ''} ${cursorClass} ${className ?? ''}`}
      onClick={asButton ? onClick : undefined}
    >
      <div className="relative">
        <div
          className={`aspect-square w-full ${bgClass} flex items-center justify-center`}
          onClick={!asButton ? onClick : undefined}
        >
          {status === 'complete' && url ? (
            <img
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            />
          ) : status === 'complete' && !url ? (
            (fallback ?? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ))
          ) : status === 'pending' ? (
            <div className="relative flex h-full w-full items-center justify-center bg-card">
              {pendingBackgroundUrl ? (
                <img
                  src={pendingBackgroundUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover grayscale opacity-30"
                />
              ) : null}
              <div className="z-10 flex flex-col items-center gap-2">
                <div className="size-5 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
                {pendingLabel && (
                  <span className="text-[10px] text-muted-foreground">
                    {pendingLabel}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card">
              <span className="text-xs text-destructive">Failed</span>
              {failedMessage && (
                <span className="text-[10px] text-muted-foreground text-center px-4">
                  {failedMessage}
                </span>
              )}
            </div>
          )}

          {imageOverlay}
        </div>

        {topLeftBadge && (
          <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            {topLeftBadge}
          </span>
        )}

        {status === 'complete' && label && (
          <span className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            {label}
          </span>
        )}

        {overlayActionsLeft && (
          <div
            className={`absolute top-1.5 left-1.5 flex items-center gap-1 transition-all ${
              status === 'failed' || alwaysShowOverlay
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {overlayActionsLeft}
          </div>
        )}

        {(onDelete || overlayActions) && (
          <div
            className={`absolute top-1.5 right-1.5 flex items-center gap-1 transition-all ${
              status === 'failed' || alwaysShowOverlay
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {overlayActions}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive transition-all"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {children}
      {footer}
    </El>
  )
}
