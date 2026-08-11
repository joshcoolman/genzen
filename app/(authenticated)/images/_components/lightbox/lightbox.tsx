'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Trash2, X } from 'lucide-react'
import styles from './lightbox.module.css'
import { cx } from '#/lib/utils'

export interface LightboxImage {
  id: string
  /** Model name for a generation, filename for an upload. */
  title: string
  /** What was sent to the provider. Absent on an upload. */
  prompt?: string
}

interface LightboxProps {
  images: Array<LightboxImage>
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
 * A job view, not an inspector (#271): the image, the prompt that made it, and
 * a filmstrip of everything else in the set. Nothing more goes in here.
 *
 * There are no prev/next buttons. Arrow keys page and the filmstrip clicks,
 * which is the whole navigation surface — chevrons were competing with the
 * image for the space this layout exists to give it.
 */
export function Lightbox({
  images,
  imageUrls,
  thumbnailUrls,
  currentIndex,
  onClose,
  onSelect,
  onNext,
  onPrev,
  onDelete,
}: LightboxProps) {
  const img = images[currentIndex]
  const imageUrl = imageUrls[img.id]
  const [loaded, setLoaded] = useState(false)
  const currentThumb = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [imageUrl])

  // Paging away has to clear the tick, or it reads as a claim about the prompt
  // now on screen.
  useEffect(() => {
    setCopied(false)
  }, [currentIndex])

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

  async function copyPrompt() {
    if (!img.prompt) return
    try {
      await navigator.clipboard.writeText(img.prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be refused (permission, an unfocused document).
      // Staying silent is right -- the tick is the only claim this makes, and
      // not showing it is an honest one.
    }
  }

  useHotkey('Escape', onClose)
  useHotkey('ArrowRight', onNext)
  useHotkey('ArrowLeft', onPrev)
  useHotkey('Delete', () => onDelete?.())
  useHotkey('Backspace', () => onDelete?.())

  return (
    <div className={styles.root} onClick={onClose}>
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
      </div>

      <aside className={styles.details} onClick={(e) => e.stopPropagation()}>
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
          // The prompt is the button (#271 follow-up): hovering tints it and
          // names the action, clicking copies. An icon in a rail beside it was
          // one more thing to aim at and one more thing to look at, and the
          // text was never selectable enough to be worth protecting.
          <button
            type="button"
            className={styles.promptButton}
            onClick={copyPrompt}
            aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          >
            <span className={styles.prompt}>{img.prompt}</span>
            <span className={styles.hint}>
              {copied ? 'Copied' : 'Copy prompt'}
            </span>
          </button>
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
