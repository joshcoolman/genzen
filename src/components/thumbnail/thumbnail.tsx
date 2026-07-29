'use client'

import { Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ExpandableIconButton } from '../expandable-icon-button/expandable-icon-button'
import { Skeleton } from '../skeleton/skeleton'
import styles from './thumbnail.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

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
  /** Brand border on hover -- the tile is one of a set the user is choosing from. */
  pickable?: boolean
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
  pickable = false,
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

  // A failed tile always shows its actions -- a Retry the user cannot see is a
  // card with no way out.
  const pinned = status === 'failed' || alwaysShowOverlay
  const reveal = pinned ? '' : styles.actionsOnHover

  return (
    <El
      className={cx(
        styles.root,
        compact && styles.rootCompact,
        onClick && styles.rootClickable,
        dimmed && styles.rootDimmed,
        selected
          ? (selectedClassName ?? styles.rootSelected)
          : pickable && styles.rootPickable,
        className,
      )}
      onClick={asButton ? onClick : undefined}
    >
      <div className={styles.frame}>
        <div
          className={cx(
            styles.canvas,
            objectFit === 'contain' && styles.canvasContain,
          )}
          onClick={!asButton ? onClick : undefined}
        >
          {status === 'complete' && url ? (
            <>
              {!loaded && (
                <Skeleton
                  className={cx(styles.skeleton, styles.skeletonOverlay)}
                />
              )}
              <img
                ref={imgRef}
                src={url}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={cx(
                  styles.image,
                  !loaded && styles.imageLoading,
                  objectFit === 'cover'
                    ? styles.imageCover
                    : styles.imageContain,
                )}
              />
            </>
          ) : status === 'complete' && !url ? (
            (fallback ?? <Skeleton className={styles.skeleton} />)
          ) : status === 'pending' ? (
            <div className={styles.state}>
              {pendingBackgroundUrl ? (
                <img
                  src={pendingBackgroundUrl}
                  alt=""
                  className={styles.stateBackdrop}
                />
              ) : null}
              <div className={styles.stateBody}>
                <div className={styles.spinner} />
                {pendingLabel && (
                  <span className={styles.stateLabel}>{pendingLabel}</span>
                )}
              </div>
            </div>
          ) : (
            <div className={cx(styles.state, styles.stateFailed)}>
              {failedBackgroundUrl ? (
                <img
                  src={failedBackgroundUrl}
                  alt=""
                  className={cx(
                    styles.stateBackdrop,
                    styles.stateBackdropFailed,
                  )}
                />
              ) : null}
              <div className={cx(styles.stateBody, styles.stateBodyFailed)}>
                <span className={styles.failedTitle}>Failed</span>
                {failedLabel && (
                  <span className={styles.stateLabel}>{failedLabel}</span>
                )}
                {failedMessage && (
                  <span className={styles.failedMessage}>{failedMessage}</span>
                )}
              </div>
            </div>
          )}

          {imageOverlay}
        </div>

        {topLeftBadge && (
          <span className={cx(styles.badge, styles.badgeTopLeft)}>
            {topLeftBadge}
          </span>
        )}

        {status === 'complete' && label && (
          <span className={cx(styles.badge, styles.badgeBottomLeft)}>
            {label}
          </span>
        )}

        {overlayActionsLeft && (
          <div className={cx(styles.actions, styles.actionsTopLeft, reveal)}>
            {overlayActionsLeft}
          </div>
        )}

        {(onDelete || overlayActions) && (
          <div className={cx(styles.actions, styles.actionsTopRight, reveal)}>
            {overlayActions}
            {onDelete && (
              <ExpandableIconButton
                icon={<Trash2 className={styles.deleteIcon} />}
                label="Delete"
                variant="destructive"
                onClick={onDelete}
              />
            )}
          </div>
        )}

        {overlayActionsBottomLeft && (
          <div className={cx(styles.actions, styles.actionsBottomLeft)}>
            {overlayActionsBottomLeft}
          </div>
        )}

        {overlayActionsBottomRight && (
          <div
            className={cx(styles.actions, styles.actionsBottomRight, reveal)}
          >
            {overlayActionsBottomRight}
          </div>
        )}
      </div>

      {children}
    </El>
  )
}
