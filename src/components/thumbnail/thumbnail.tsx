'use client'

import { Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ExpandableIconButton } from '../expandable-icon-button/expandable-icon-button'
import type { ReactNode } from 'react'

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-muted/50 ${className}`}
      aria-hidden="true"
    />
  )
}

export interface ThumbnailProps {
  url?: string | null
  alt?: string
  status?: 'pending' | 'complete' | 'failed'

  pendingLabel?: string
  pendingBackgroundUrl?: string

  failedLabel?: string
  failedMessage?: string
  failedBackgroundUrl?: string

  label?: string
  topLeftBadge?: string

  onDelete?: () => void
  overlayActions?: ReactNode
  overlayActionsLeft?: ReactNode
  overlayActionsBottomLeft?: ReactNode
  overlayActionsBottomRight?: ReactNode

  onClick?: (e?: React.MouseEvent) => void

  selected?: boolean
  selectedClassName?: string

  alwaysShowOverlay?: boolean
  compact?: boolean
  dimmed?: boolean
  hoverBorder?: string
  objectFit?: 'contain' | 'cover'
  asButton?: boolean
  fallback?: ReactNode
  imageOverlay?: ReactNode
  className?: string

  children?: ReactNode
}

export function Thumbnail({
  url,
  alt,
  status = 'complete',
  pendingLabel,
  pendingBackgroundUrl,
  failedLabel,
  failedMessage,
  failedBackgroundUrl,
  label,
  topLeftBadge,
  onDelete,
  overlayActions,
  overlayActionsLeft,
  overlayActionsBottomLeft,
  overlayActionsBottomRight,
  onClick,
  selected,
  selectedClassName,
  alwaysShowOverlay = false,
  compact = false,
  dimmed = false,
  hoverBorder,
  objectFit = 'contain',
  asButton = false,
  fallback,
  imageOverlay,
  className,
  children,
}: ThumbnailProps) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) setLoaded(true)
    },
    [url],
  )
  const El = asButton ? 'button' : 'div'
  const bgClass = objectFit === 'contain' ? 'bg-black p-2.5' : ''
  const cursorClass = onClick ? 'cursor-pointer' : ''

  // Grid layout
  const rounding = compact ? 'rounded-md' : 'rounded-lg'

  return (
    <El
      className={`group relative overflow-hidden ${rounding} border bg-card flex flex-col ${
        selected
          ? (selectedClassName ?? 'border-primary ring-1 ring-primary')
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
            <>
              {!loaded && (
                <Skeleton className="absolute inset-0 h-full w-full" />
              )}
              <img
                ref={imgRef}
                src={url}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
              />
            </>
          ) : status === 'complete' && !url ? (
            (fallback ?? <Skeleton className="h-full w-full" />)
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
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 bg-card">
              {failedBackgroundUrl ? (
                <img
                  src={failedBackgroundUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover grayscale opacity-20"
                />
              ) : null}
              <div className="relative z-10 flex flex-col items-center gap-1 px-4">
                <span className="text-xs text-destructive">Failed</span>
                {failedLabel && (
                  <span className="text-[10px] text-muted-foreground">
                    {failedLabel}
                  </span>
                )}
                {failedMessage && (
                  <span className="text-xs text-foreground/50 border border-foreground/30 rounded-full px-2.5 py-0.5 mt-2.5">
                    {failedMessage}
                  </span>
                )}
              </div>
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
              <ExpandableIconButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete"
                variant="destructive"
                onClick={onDelete}
              />
            )}
          </div>
        )}

        {overlayActionsBottomLeft && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
            {overlayActionsBottomLeft}
          </div>
        )}

        {overlayActionsBottomRight && (
          <div
            className={`absolute bottom-1.5 right-1.5 flex items-center gap-1 transition-all ${
              status === 'failed' || alwaysShowOverlay
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {overlayActionsBottomRight}
          </div>
        )}
      </div>

      {children}
    </El>
  )
}
