'use client'

import { useCallback, useEffect, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  ScanText,
  Trash2,
  X,
} from 'lucide-react'
import { CopyText } from '../copy-text/copy-text'
import { MiniButton } from '../mini-button/mini-button'
import styles from './image-viewer.module.css'
import { cx } from '#/lib/utils'
import { usePersistedState } from '#/lib/use-persisted-state'

/**
 * One picture in the viewer's ring.
 *
 * Declared here rather than by whatever built the list, because this is the
 * only shape the viewer knows about and two surfaces now fill it from
 * different rows -- an Images gallery row, and a Director session's reference
 * sheets (#690).
 */
export interface ViewerItem {
  id: string
  /** Model name for a generation, filename for an upload. Alt text only. */
  title: string
  /** What the prompt panel reads (#580). Absent where there is nothing that
   *  made the picture -- the panel then says so rather than inventing a
   *  caption out of a filename. */
  prompt?: string
  /** An upload, whose prompt *is* its stored description -- so the panel can
   *  offer to write one (#585). A generation's panel reads its own prompt,
   *  which describing would not change. */
  describable?: boolean
}

/** One key, so the panel is the same on every image and in every session. */
const PROMPT_PANEL_KEY = 'genzen:viewer-prompt'

interface ImageViewerProps {
  items: Array<ViewerItem>
  imageUrls: Record<string, string>
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: () => void
  /** Hide the current image and move on (#545). */
  onHide?: () => void
  /** Cmd/Ctrl-click on the panel's prompt loads it into the generator, the
   *  same gesture the card's caption carries. */
  onUsePrompt?: (text: string) => void
  /** Describe the image and store the result over any existing description.
   *  Offered only on a `describable` item; absent, the panel has no button. */
  onDescribe?: (id: string) => void
  describeStates?: Partial<Record<string, { busy: boolean; error?: string }>>
}

/**
 * A lightbox: scrim over the whole app, the picture as large as it fits,
 * chevrons either side, an X, a counter -- and a prompt column you can switch
 * off. No filmstrip, no metadata.
 *
 * **The prompt panel is a mode, not a per-image click** (#580). `P` toggles
 * it and the answer is remembered, because judging a set means going through
 * forty takes and a per-image toggle would be forty keystrokes. On by default:
 * reading the prompt is most of what the viewer is now for -- it used to mean
 * closing the viewer to read the card's clamped three lines.
 *
 * The former Explore overlay imposed a prompt column and filmstrip when
 * Images shared it. Here the prompt is opt-out; switching it off restores
 * the plain lightbox.
 *
 * Every control is visible. An earlier preview here hid its paging in
 * invisible quarters of the screen that revealed a chevron once the pointer
 * was already inside them, which confirms rather than affords -- you had to
 * move the mouse to find out what the mouse could do.
 *
 * **Shared, but only the shell** (#690). `useImageViewer` stayed in Images on
 * its own warning: sharing the *cursor* with the former Explore surface is
 * what imposed a prompt column and a filmstrip here. The cursor is where a
 * surface's own rules live -- what the set is, what Delete means -- so each
 * one keeps its own and hands this component the same four props.
 */
export function ImageViewer({
  items,
  imageUrls,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
  onHide,
  onUsePrompt,
  onDescribe,
  describeStates,
}: ImageViewerProps) {
  const [showPrompt, setShowPrompt, hydrated] = usePersistedState(
    () => window.localStorage.getItem(PROMPT_PANEL_KEY) !== 'off',
    true,
  )

  // Gated on `hydrated` or the first render writes the default over whatever
  // was stored, and the setting resets on every load.
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(PROMPT_PANEL_KEY, showPrompt ? 'on' : 'off')
  }, [showPrompt, hydrated])

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
  /* **Delete destroys, H clears away** (#545) -- the card's own arrangement
     (#504) at the surface where the judging happens. A bare letter is safe
     here because the viewer holds no text field; nothing in it can be typed
     into. */
  useHotkey('H', () => onHide?.())
  /* Same reasoning as `H`: a bare letter is safe because nothing in here can
     be typed into. */
  useHotkey('P', () => setShowPrompt((on) => !on))

  const describe =
    item?.describable && onDescribe ? () => onDescribe(item.id) : undefined
  const describeState = item ? describeStates?.[item.id] : undefined
  /* Same reasoning as `H`. Works with the panel off too: the result lands on
     the card either way. */
  useHotkey('D', () => {
    if (!describeState?.busy) describe?.()
  })

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
      {/* The picture's half of the overlay. The chevrons, the counter and the
          X anchor to *this* rather than to the viewport, so opening the panel
          moves them in with the image instead of stranding the X on top of
          the prompt. */}
      <div className={styles.main}>
        <div className={styles.stage}>
          {/* The frame shrink-wraps the picture, so it *is* the picture's box
            whatever the aspect ratio. That is what lets Trash sit on the
            image's own lower-left corner rather than the viewport's -- against
            the viewport it drifts into empty scrim beside a portrait image. */}
          <div className={styles.frame}>
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

            {/* On the image, far from the X. The two shared a corner at first,
              which put "delete this" one small slip from "close this".

              Hide sits beside Trash rather than being key-only, because the
              destructive verb was the only *visible* one in here -- which is
              the inversion #504 removed from the card. Leftmost, the way it is
              leftmost in reading order on the card's corner. */}
            {(onHide || onDelete) && url && (
              <div
                className={styles.actions}
                // Or the backdrop handler closes on the way out, and the point of
                // acting from here is to keep going through the set.
                onClick={(e) => e.stopPropagation()}
              >
                {onHide && (
                  <button
                    type="button"
                    className={cx(styles.action, styles.hide)}
                    onClick={onHide}
                    aria-label="Hide"
                    title="Hide (H)"
                  >
                    <EyeOff className={styles.controlIcon} />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className={cx(styles.action, styles.delete)}
                    onClick={onDelete}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className={styles.controlIcon} />
                  </button>
                )}
              </div>
            )}
          </div>
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

      {/* Rendered whether or not there is a prompt to show. An upload dropping
          the column would make the layout jump as you page past it, which is
          the one thing a fixed panel is for. */}
      {showPrompt && (
        <aside
          className={styles.panel}
          onClick={(e) => e.stopPropagation()}
          aria-label="Prompt"
        >
          <span className={styles.panelTitle}>{item.title}</span>
          {item.prompt ? (
            /* The card's contract, unchanged: click copies, Cmd-click loads it
               into the generator. `key` so a tick left standing never reads as
               a claim about the image you have just paged to. */
            <CopyText
              key={item.id}
              text={item.prompt}
              label="Copy"
              onModifierClick={onUsePrompt}
              modifierLabel="Load into the panel"
              className={styles.panelPrompt}
              textClassName={styles.panelPromptText}
            />
          ) : (
            <p className={styles.panelEmpty}>
              No prompt -- this image was uploaded.
            </p>
          )}
          {describe && (
            <div className={styles.panelActions}>
              {/* Always overwrites: the button is how you ask again, so a
                  description already there is not a reason to refuse. */}
              <MiniButton
                icon={<ScanText />}
                spinning={describeState?.busy}
                disabled={describeState?.busy}
                onClick={describe}
                title="Describe (D)"
              >
                {describeState?.busy
                  ? 'Describing...'
                  : item.prompt
                    ? 'Describe again'
                    : 'Describe'}
              </MiniButton>
              {describeState?.error && (
                <p className={styles.panelError}>{describeState.error}</p>
              )}
            </div>
          )}
        </aside>
      )}

      {/* Lower left of the viewport, stating the mode rather than teaching the
          key. It is a button as well as a label because the gesture has to be
          reachable without knowing about `P`. */}
      <button
        type="button"
        className={styles.promptToggle}
        onClick={(e) => {
          e.stopPropagation()
          setShowPrompt((on) => !on)
        }}
        title="Toggle the prompt (P)"
      >
        Prompt: {showPrompt ? 'on' : 'off'}
      </button>
    </div>
  )
}
