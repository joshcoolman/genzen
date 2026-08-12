'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './experiment.module.css'
import type { LightboxItem } from '../../_hooks/use-lightbox'
import { isKeyboardCaptured } from '#/lib/keyboard-capture'
import { cx } from '#/lib/utils'

interface ExperimentProps {
  items: Array<LightboxItem>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}

/**
 * One image, as large as the grid area can show it. Not a lightbox: no scrim
 * and no darkening the app. The toolbar stays put and the region the thumbnails
 * occupied becomes a single preview.
 *
 * Open with a click, close with a click. Arrow keys step through the same list
 * the grid is showing; Escape also closes.
 *
 * It covers the grid rather than replacing it, so the grid stays mounted and
 * closing lands back on the same scroll position -- the whole point, since this
 * is meant to be stepped in and out of constantly.
 *
 * Positioned by measurement rather than by CSS: "the grid area" is the shell's
 * sidebar on one side and a generator dock that may or may not be pushing the
 * workspace on the other, and hard-coding that arithmetic in two places is how
 * the two drift apart.
 */
export function Experiment({
  items,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: ExperimentProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  // The anchor is a zero-height marker at the top of the grid area; the panel
  // hangs off its rect down to the bottom of the viewport.
  //
  // Observed rather than measured once. The grid area moves under it while the
  // preview is open -- the generator dock pushes the workspace 20rem and takes
  // it back, the sidebar appears at 48rem -- and both are CSS transitions, so
  // there is no single moment afterwards that is the right one to measure at.
  // The observer fires all the way through the animation instead.
  useLayoutEffect(() => {
    const el = anchorRef.current
    const area = el?.parentElement
    if (!area) return

    // The anchor supplies all three: it sits below the toolbar, so its top is
    // where the grid area starts, and being a block it is already the full
    // width of the workspace. The parent is what gets observed, because it is
    // the thing whose box actually changes.
    //
    // Clamped at 0, because scrolled down the grid the anchor is above the
    // viewport and its top is negative -- which put the panel mostly
    // off-screen and centred the image somewhere you could not see, reading as
    // a blank screen. Below the fold there is no toolbar to stay clear of
    // anyway, so the preview takes the full height.
    function measure() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      setBox({
        top: Math.max(rect.top, 0),
        left: rect.left,
        width: rect.width,
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // The page behind must not scroll: the panel's top is measured once, and a
  // scroll under it would slide the grid out from under a fixed box.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // One line to honour: the search overlay is mounted globally and can open
      // over this, and its query field wants the arrow keys.
      if (isKeyboardCaptured()) return
      if (e.key === 'ArrowRight') onNext()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'Escape') onClose()
      else return
      e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNext, onPrev, onClose])

  // Cast because the index really can outrun the list: the gallery's 5s poll
  // can drop a row while the preview is open, and TS is not checking indexed
  // access here.
  const item = items[currentIndex] as LightboxItem | undefined
  const url = item && imageUrls[item.id]

  return (
    <div ref={anchorRef} className={styles.anchor}>
      {box && (
        <div
          className={styles.panel}
          style={{ top: box.top, left: box.left, width: box.width }}
        >
          {/* `contain` and a max of 100%: a portrait image goes as tall as the
              area allows, a landscape one as wide, and neither leaves it. */}
          {url && <img className={styles.image} src={url} alt={item.title} />}

          {/* Three zones over the whole panel: the outer quarters step, the
              middle half closes. No X and no permanent chevrons -- the target
              is a quarter of the screen and the glyph only shows up once you
              are already inside the thing you would click, so it confirms
              rather than decorates.

              Quarters of the panel rather than of the image: the targets stay
              large whatever the aspect ratio, and for a portrait image the
              ground either side becomes useful instead of dead. */}
          <button
            type="button"
            className={cx(styles.zone, styles.zonePrev)}
            onClick={onPrev}
            aria-label="Previous image"
          >
            <ChevronLeft className={styles.chevron} />
          </button>
          <div
            className={styles.zoneClose}
            onClick={onClose}
            aria-hidden="true"
          />
          <button
            type="button"
            className={cx(styles.zone, styles.zoneNext)}
            onClick={onNext}
            aria-label="Next image"
          >
            <ChevronRight className={styles.chevron} />
          </button>
        </div>
      )}
    </div>
  )
}
