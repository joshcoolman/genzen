'use client'

import { useCallback, useEffect, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import styles from './lightbox.module.css'
import { cx } from '#/lib/utils'

export interface LightboxImage {
  id: string
  url: string
  title: string
}

interface LightboxProps {
  images: Array<LightboxImage>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
  onEdit?: () => void
}

export function Lightbox({
  images,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
  onEdit,
}: LightboxProps) {
  const img = images[currentIndex]
  const imageUrl = imageUrls[img.id]
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [imageUrl])

  // Preload adjacent images into browser cache
  const preloadAdjacent = useCallback(() => {
    for (const offset of [-1, 1, -2, 2]) {
      const adjIdx = currentIndex + offset
      if (adjIdx < 0 || adjIdx >= images.length) continue
      const adjImg = images[adjIdx]
      const adjUrl = imageUrls[adjImg.id]
      if (adjUrl) {
        const preload = new Image()
        preload.src = adjUrl
      }
    }
  }, [imageUrls, currentIndex, images])

  useEffect(() => {
    preloadAdjacent()
  }, [preloadAdjacent])

  useHotkey('Escape', onClose)
  useHotkey('ArrowRight', onNext)
  useHotkey('ArrowLeft', onPrev)
  useHotkey('Delete', () => onDelete?.())
  useHotkey('Backspace', () => onDelete?.())

  return (
    <div className={styles.root} onClick={onClose}>
      {/* Close */}
      <button
        className={cx(styles.control, styles.close)}
        onClick={onClose}
        aria-label="Close"
      >
        <X className={styles.closeIcon} />
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          className={cx(styles.control, styles.prev)}
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          aria-label="Previous"
        >
          <ChevronLeft className={styles.arrowIcon} />
        </button>
      )}

      {/* Image with title + action overlays */}
      <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
        <div className={styles.frame}>
          {imageUrl ? (
            <div className={styles.imageWrap}>
              {!loaded && (
                <div
                  className={cx(styles.placeholder, styles.placeholderOverlay)}
                />
              )}
              <img
                key={imageUrl}
                src={imageUrl}
                alt={img.title}
                className={cx(styles.image, !loaded && styles.imageLoading)}
                onLoad={() => setLoaded(true)}
              />
            </div>
          ) : (
            <div className={cx(styles.placeholder, styles.placeholderEmpty)} />
          )}
          {onEdit && (
            <button
              className={cx(styles.action, styles.edit)}
              onClick={onEdit}
              aria-label="Edit"
            >
              <Pencil className={styles.actionIcon} />
            </button>
          )}
          {onDelete && (
            <button
              className={cx(styles.action, styles.delete)}
              onClick={onDelete}
              aria-label="Delete"
            >
              <Trash2 className={styles.actionIcon} />
            </button>
          )}
        </div>
        {img.title && <p className={styles.title}>{img.title}</p>}
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          className={cx(styles.control, styles.next)}
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          aria-label="Next"
        >
          <ChevronRight className={styles.arrowIcon} />
        </button>
      )}
    </div>
  )
}
