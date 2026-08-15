'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Trash2, X } from 'lucide-react'
import styles from './image-detail.module.css'
import { cx } from '#/lib/utils'
import { CopyText } from '#/components'

export interface ImageDetailItem {
  id: string
  /** Model name for a generation, filename for an upload. */
  title: string
  /** What was sent to the provider. Absent on an upload. */
  prompt?: string
}

interface ImageDetailProps {
  images: Array<ImageDetailItem>
  imageUrls: Record<string, string>
  thumbnailUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onSelect: (index: number) => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
}

/**
 * Explore's overlay: the image, the prompt that made it, and a filmstrip of
 * everything else on the wall. Three columns, modelled on
 * `docs/reference/images/midjourney-job-view.jpg` (#271). Nothing more goes in
 * here.
 *
 * There are no prev/next buttons. Arrow keys page and the filmstrip clicks,
 * which is the whole navigation surface — chevrons were competing with the
 * image for the space this layout exists to give it.
 *
 * **This is not a lightbox and must not be named like one.** It answers "what
 * made this picture"; a lightbox answers "show me this bigger" and looks
 * nothing like it — scrim, chevrons, an X, no text at all. /images has one of
 * those in its own `image-viewer/`.
 *
 * The naming is load-bearing because getting it wrong cost two rounds of the
 * same mistake. This file was `images/_components/lightbox/`, borrowed by
 * Explore, so anyone wanting a plain viewer on /images found "a lightbox"
 * already in the tree, wired to it, and got a prompt column and a filmstrip
 * they never asked for. It was briefly `job-view/`, which is Midjourney's word
 * for a generation and means nothing here.
 *
 * Explore owns this and is its only consumer. If a second surface wants one,
 * that is a conversation, not an import.
 */
export function ImageDetail({
  images,
  imageUrls,
  thumbnailUrls,
  currentIndex,
  onClose,
  onSelect,
  onNext,
  onPrev,
  onDelete,
}: ImageDetailProps) {
  const img = images[currentIndex]
  const imageUrl = imageUrls[img.id]
  const [loaded, setLoaded] = useState(false)
  const currentThumb = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLElement>(null)

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

  // The strip is longer than the viewport, so position feedback is most of its
  // value: hold the current thumbnail near centre rather than merely on screen.
  //
  // Scrolled by hand rather than with scrollIntoView({block: 'center'}), which
  // moved nothing here -- and silently, leaving the highlighted thumbnail off
  // screen while every other part of paging looked correct.
  useEffect(() => {
    const thumb = currentThumb.current
    const strip = stripRef.current
    if (!thumb || !strip) return
    strip.scrollTo({
      top: thumb.offsetTop - strip.clientHeight / 2 + thumb.clientHeight / 2,
      behavior: 'smooth',
    })
  }, [currentIndex])

  useHotkey('Escape', onClose)
  useHotkey('ArrowRight', onNext)
  useHotkey('ArrowLeft', onPrev)
  useHotkey('Delete', () => onDelete?.())
  useHotkey('Backspace', () => onDelete?.())

  return (
    <div className={styles.root} onClick={onClose}>
      {/* The stage does not swallow the click. Landing on the image is the
          fastest way back to the grid: look, page a few, copy a prompt, click
          anywhere that is not a control and you are out. */}
      <div className={styles.stage}>
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
          {onDelete && (
            <button
              className={cx(styles.action, styles.delete)}
              onClick={(e) => {
                // Or deleting would close on the way out, and the point of
                // deleting from here is to keep going through the set.
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Delete"
            >
              <Trash2 className={styles.actionIcon} />
            </button>
          )}
        </div>
      </div>

      {/* Same for the prompt column's empty space. Its two controls stop the
          click themselves -- CopyText always does, and Close is closing
          anyway. */}
      <aside className={styles.details}>
        <div className={styles.head}>
          <h2 className={styles.model}>{img.title}</h2>
          <button
            className={cx(styles.control, styles.close)}
            onClick={onClose}
            aria-label="Close"
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        {img.prompt ? (
          // The prompt is the button (#271 follow-up). Keyed on the image so
          // paging away clears the tick, which would otherwise read as a claim
          // about the prompt now on screen.
          <CopyText
            key={img.id}
            text={img.prompt}
            label="Copy prompt"
            className={styles.promptButton}
            textClassName={styles.prompt}
          />
        ) : (
          // An upload has no prompt. The column stays either way: a mixed set
          // would jump on every page if the layout changed with the row.
          <p className={cx(styles.prompt, styles.promptEmpty)}>
            Uploaded image
          </p>
        )}
      </aside>

      <nav
        ref={stripRef}
        className={styles.filmstrip}
        onClick={(e) => e.stopPropagation()}
        aria-label="Images in this set"
      >
        {images.map((item, i) => (
          <button
            key={item.id}
            ref={i === currentIndex ? currentThumb : undefined}
            className={cx(styles.thumb, i === currentIndex && styles.thumbOn)}
            onClick={() => onSelect(i)}
            aria-label={item.title}
            aria-current={i === currentIndex}
          >
            <img
              src={thumbnailUrls[item.id] ?? imageUrls[item.id]}
              alt=""
              className={styles.thumbImage}
              loading="lazy"
            />
          </button>
        ))}
      </nav>
    </div>
  )
}
