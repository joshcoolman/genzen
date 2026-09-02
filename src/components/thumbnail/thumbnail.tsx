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

  pendingBackgroundUrl?: string

  failedMessage?: string
  failedBackgroundUrl?: string

  label?: string
  topLeftBadge?: string
  /**
   * The model name, bottom-right on the picture, in every state the card has
   * (#367). It was ImageCard's alone, so a generation labelled itself in the
   * caption while pending and in the corner once complete -- the label moved
   * at the one moment the card is being watched. One definition here rather
   * than a copy in each module, which is how the field washes drifted (#346).
   */
  bottomRightBadge?: string

  onDelete?: () => void
  overlayActions?: ReactNode
  overlayActionsLeft?: ReactNode
  overlayActionsBottomLeft?: ReactNode
  overlayActionsBottomRight?: ReactNode

  onClick?: (e?: React.MouseEvent) => void
  /** On the root, so a caller can react to the pointer being over the whole
   *  tile rather than over whichever part of it the pointer is actually on. */
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void

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
  /** `data-*` attributes on the root. The grid's pointer gestures find their
   *  targets by hit-testing the DOM rather than through a React handler --
   *  the sweep's rectangle (#440), the drag's drop targets (#438) -- so a tile
   *  has to say what it is somewhere `closest()` and `querySelectorAll` can
   *  read it. Names only: this is a marker seam, not a props escape hatch. */
  dataAttrs?: Record<`data-${string}`, string>

  children?: ReactNode
}

export function Thumbnail({
  url,
  alt,
  status = 'complete',
  pendingBackgroundUrl,
  failedMessage,
  failedBackgroundUrl,
  label,
  topLeftBadge,
  bottomRightBadge,
  onDelete,
  overlayActions,
  overlayActionsLeft,
  overlayActionsBottomLeft,
  overlayActionsBottomRight,
  onClick,
  onMouseEnter,
  onMouseLeave,
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
  dataAttrs,
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...dataAttrs}
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
              {/* The spinner alone. It named its model underneath until #367
                  gave every state the same corner badge, at which point this
                  was the same word twice on one tile. */}
              <div className={styles.stateBody}>
                <div className={styles.spinner} />
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

        {bottomRightBadge && (
          <span className={styles.modelBadge}>{bottomRightBadge}</span>
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
