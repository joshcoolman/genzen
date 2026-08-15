'use client'

import { useCallback, useEffect, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import styles from './image-viewer.module.css'
import type { ViewerItem } from '../../_hooks/use-image-viewer'
import { cx } from '#/lib/utils'

interface ImageViewerProps {
  items: Array<ViewerItem>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
}

/**
 * A plain lightbox. Scrim over the whole app, the picture as large as it fits,
 * chevrons either side, an X, and a counter. Nothing else -- no prompt, no
 * filmstrip, no metadata. "Show me this bigger and let me move through the
 * set" is the entire job.
 *
 * Explore's `image-detail/` is a different thing that happens to also be an
 * overlay, and the two are deliberately not shared: the last arrangement had
 * /images rendering that one, which put a prompt column and a filmstrip on a
 * surface that wanted neither.
 *
 * Every control is visible. An earlier preview here hid its paging in
 * invisible quarters of the screen that revealed a chevron once the pointer
 * was already inside them, which confirms rather than affords -- you had to
 * move the mouse to find out what the mouse could do.
 */
export function ImageViewer({
  items,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
}: ImageViewerProps) {
  // The index really can outrun the list: the gallery's 5s poll can drop a row
  // while this is open, and TS is not checking indexed access here.
  const item = items[currentIndex] as ViewerItem | undefined
  const url = item && imageUrls[item.id]
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [url])

  // Paging should not wait on the network. Two either side covers a held arrow
  // key without fetching the whole set.
  const preloadAdjacent = useCallback(() => {
    for (const offset of [-1, 1, -2, 2]) {
      // Cast for the same reason as `item` above: the offsets run off both
      // ends of the list and TS is not checking indexed access here.
      const adj = items[currentIndex + offset] as ViewerItem | undefined
      const adjUrl = adj && imageUrls[adj.id]
      if (adjUrl) {
        const preload = new Image()
        preload.src = adjUrl
      }
    }
  }, [items, imageUrls, currentIndex])

  useEffect(() => {
    preloadAdjacent()
  }, [preloadAdjacent])

  // The page behind must not scroll -- a fixed overlay leaves the grid free to
  // move under it, so closing lands somewhere else than where you opened from.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useHotkey('Escape', onClose)
  useHotkey('ArrowRight', onNext)
  useHotkey('ArrowLeft', onPrev)
  useHotkey('Delete', () => onDelete?.())
  useHotkey('Backspace', () => onDelete?.())

  if (!item) return null

  return (
    // Clicking the backdrop closes; the image does not. That is the
    // conventional contract, and it is the one that lets you point at the
    // picture, lean in, and not lose it.
    <div
      className={styles.root}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <div className={styles.stage}>
        {url ? (
          <img
            key={url}
            src={url}
            alt={item.title}
            className={cx(styles.image, !loaded && styles.imageLoading)}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className={styles.placeholder} />
        )}
      </div>

      {/* Chevrons sit on the scrim rather than on the picture, so they never
          cover the thing you opened this to look at. Both are always present:
          the set wraps, so neither is ever a dead control. */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            className={cx(styles.nav, styles.navPrev)}
            onClick={(e) => {
              e.stopPropagation()
              onPrev()
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className={styles.navIcon} />
          </button>
          <button
            type="button"
            className={cx(styles.nav, styles.navNext)}
            onClick={(e) => {
              e.stopPropagation()
              onNext()
            }}
            aria-label="Next image"
          >
            <ChevronRight className={styles.navIcon} />
          </button>
        </>
      )}

      <div className={styles.topBar} onClick={(e) => e.stopPropagation()}>
        {/* Position, not identity. With no filmstrip this is the only thing
            saying how big the set is and where in it you are. */}
        {items.length > 1 && (
          <span className={styles.counter}>
            {currentIndex + 1} of {items.length}
          </span>
        )}
        <div className={styles.topActions}>
          {onDelete && (
            <button
              type="button"
              className={cx(styles.control, styles.delete)}
              onClick={onDelete}
              aria-label="Delete"
            >
              <Trash2 className={styles.controlIcon} />
            </button>
          )}
          <button
            type="button"
            className={styles.control}
            onClick={onClose}
            aria-label="Close"
          >
            <X className={styles.controlIcon} />
          </button>
        </div>
      </div>
    </div>
  )
}
