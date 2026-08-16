'use client'

import { useEffect, useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Trash2, X } from 'lucide-react'
import { useWheelStep } from '../../_hooks/use-wheel-step'
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
  const currentThumb = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  /** Which way the last step went, so preloading runs ahead of you. */
  const directionRef = useRef<1 | -1>(1)
  /** True while a wheel gesture is in flight. Not state: the only thing that
   *  reads it is the filmstrip effect, and re-rendering the whole overlay on
   *  every wheel event is exactly what this is trying to avoid. */
  const wheelingRef = useRef(false)

  // The image on screen, which trails the selection by however long the new one
  // takes to decode. Paging used to blank the frame on every step -- `loaded`
  // reset to false, a pulsing placeholder over an `opacity: 0` image -- even
  // when the next image was already in cache from the preload below. At
  // keyboard speed that reads as a load; on the wheel it strobes, and stepping
  // instantly through a strobe is not faster than what it replaced (#393).
  const [shownUrl, setShownUrl] = useState<string | undefined>(imageUrl)
  /** Only once a swap is genuinely slow does the placeholder come back. */
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!imageUrl) {
      setShownUrl(undefined)
      return
    }
    if (imageUrl === shownUrl) return

    let cancelled = false
    const show = () => {
      if (cancelled) return
      setShownUrl(imageUrl)
      setSlow(false)
    }

    const next = new Image()
    next.src = imageUrl
    if (next.complete) {
      // Cached: swap in the same frame, no placeholder, no flash.
      show()
      return
    }

    // Not cached. Hold the outgoing image rather than blanking, and only admit
    // to loading if it takes long enough to read as one.
    const timer = setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, 250)
    next.decode().then(show, show)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [imageUrl, shownUrl])

  // Warm the neighbours, further ahead in the direction of travel: a wheel
  // gesture leaves a window of +/-2 behind immediately.
  useEffect(() => {
    const ahead = directionRef.current
    for (const offset of [1, 2, 3, 4, -1, -2]) {
      const adjIdx = currentIndex + offset * ahead
      if (adjIdx < 0 || adjIdx >= images.length) continue
      const adjUrl = imageUrls[images[adjIdx].id]
      if (adjUrl) {
        const preload = new Image()
        preload.src = adjUrl
      }
    }
  }, [imageUrls, currentIndex, images])

  // The strip is longer than the viewport, so position feedback is most of its
  // value: hold the current thumbnail near centre rather than merely on screen.
  //
  // Scrolled by hand rather than with scrollIntoView({block: 'center'}), which
  // moved nothing here -- and silently, leaving the highlighted thumbnail off
  // screen while every other part of paging looked correct.
  //
  // Instant while wheeling, smooth otherwise. A smooth scroll restarts from
  // wherever the last one reached, so under a fast gesture the rail visibly
  // trailed the selection and never settled.
  useEffect(() => {
    const thumb = currentThumb.current
    const strip = stripRef.current
    if (!thumb || !strip) return
    strip.scrollTo({
      top: thumb.offsetTop - strip.clientHeight / 2 + thumb.clientHeight / 2,
      behavior: wheelingRef.current ? 'auto' : 'smooth',
    })
  }, [currentIndex])

  useWheelStep(
    rootRef,
    (direction) => {
      directionRef.current = direction
      direction === 1 ? onNext() : onPrev()
    },
    (active) => {
      wheelingRef.current = active
    },
  )

  useHotkey('Escape', onClose)
  useHotkey('ArrowRight', onNext)
  useHotkey('ArrowLeft', onPrev)
  useHotkey('Delete', () => onDelete?.())
  useHotkey('Backspace', () => onDelete?.())

  return (
    <div ref={rootRef} className={styles.root} onClick={onClose}>
      {/* The stage does not swallow the click. Landing on the image is the
          fastest way back to the grid: look, page a few, copy a prompt, click
          anywhere that is not a control and you are out. */}
      <div className={styles.stage}>
        <div className={styles.frame}>
          {shownUrl ? (
            <div className={styles.imageWrap}>
              {slow && (
                <div
                  className={cx(styles.placeholder, styles.placeholderOverlay)}
                />
              )}
              <img
                key={shownUrl}
                src={shownUrl}
                alt={img.title}
                className={cx(styles.image, slow && styles.imageLoading)}
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
