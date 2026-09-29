'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, Info, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog'
import { Sheet, SheetContent, SheetTitle } from '../sheet/sheet'
import styles from './mobile-media-viewer.module.css'
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { cx } from '#/lib/utils'

const SLIDE_MS = 180

/** The phone's media stage. Callers own the media and cursor; this shell owns
 *  touch controls, modal focus, details, and confirmation before removal. */
export function MobileMediaViewer({
  itemId,
  kind,
  title,
  children,
  position,
  count,
  onClose,
  onPrevious,
  onNext,
  onDelete,
  onTogglePlayback,
  details,
}: {
  itemId: string
  kind: 'image' | 'video'
  /** Must include a DialogTitle, including while editing a name. */
  title: ReactNode
  children: ReactNode
  position: number
  count: number
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
  onDelete?: () => void
  onTogglePlayback?: () => void
  details?: ReactNode
}) {
  const [mediaSize, setMediaSize] = useState<{
    id: string
    ratio: number
  } | null>(null)
  const readMediaSize = (event: SyntheticEvent) => {
    const media = event.target
    const width =
      media instanceof HTMLVideoElement
        ? media.videoWidth
        : media instanceof HTMLImageElement
          ? media.naturalWidth
          : 0
    const height =
      media instanceof HTMLVideoElement
        ? media.videoHeight
        : media instanceof HTMLImageElement
          ? media.naturalHeight
          : 0
    if (width && height) setMediaSize({ id: itemId, ratio: width / height })
  }
  const pressedEmptySpace = useRef(false)
  // Images only: a horizontal drag on a video fights its native scrubber.
  const swipes = kind === 'image'
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sliding = useRef(false)
  const slideTimers = useRef<Array<number>>([])
  useEffect(() => () => slideTimers.current.forEach(clearTimeout), [])

  // The image rides --slide-x; data-sliding turns the easing on for the
  // animated legs and off while it tracks a finger.
  const setSlide = (x: number, animate: boolean) => {
    const stage = stageRef.current
    if (!stage) return
    stage.style.setProperty('--slide-x', `${x}px`)
    stage.toggleAttribute('data-sliding', animate)
  }
  const later = (ms: number, fn: () => void) => {
    slideTimers.current.push(window.setTimeout(fn, ms))
  }

  /** One step: the current image leaves, the next arrives from the far side.
   *  Anything asked for mid-slide is dropped, so a flurry moves one image. */
  const slide = (direction: 1 | -1) => {
    const go = direction === 1 ? onNext : onPrevious
    const stage = stageRef.current
    if (!go || sliding.current) return
    if (
      !swipes ||
      !stage ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setSlide(0, false)
      go()
      return
    }
    sliding.current = true
    const width = stage.clientWidth
    setSlide(-direction * width, true)
    later(SLIDE_MS, () => {
      go()
      setSlide(direction * width, false)
      // Two frames so the off-screen start is painted before easing home.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSlide(0, true)
          later(SLIDE_MS, () => {
            stageRef.current?.removeAttribute('data-sliding')
            sliding.current = false
          })
        }),
      )
    })
  }
  const closeRef = useRef<HTMLButtonElement>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const confirming = deleteId === itemId
  const blocked = confirming || detailsOpen
  const requestDelete = () => {
    if (onDelete) setDeleteId(itemId)
  }

  useEffect(() => {
    // A list refresh must never transfer an old confirmation to a new item.
    setDeleteId(null)
    setDetailsOpen(false)
  }, [itemId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (blocked || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        slide(event.key === 'ArrowLeft' ? -1 : 1)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        if (onDelete) setDeleteId(itemId)
      } else if (
        event.key === ' ' &&
        onTogglePlayback &&
        !target?.closest('button, video')
      ) {
        event.preventDefault()
        onTogglePlayback()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  return (
    <BaseDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Popup className={styles.viewer} initialFocus={closeRef}>
          <header className={styles.header}>
            <div className={styles.title}>{title}</div>
            <BaseDialog.Close
              ref={closeRef}
              className={styles.icon}
              aria-label="Close"
            >
              <X size={22} />
            </BaseDialog.Close>
          </header>
          <div
            className={cx(styles.stage, swipes && styles.swipes)}
            style={
              {
                '--media-ratio': mediaSize?.id === itemId ? mediaSize.ratio : 1,
              } as CSSProperties
            }
            onLoadCapture={readMediaSize}
            onLoadedMetadataCapture={readMediaSize}
            ref={stageRef}
            onPointerDown={(event) => {
              pressedEmptySpace.current = event.target === event.currentTarget
              // A second finger is a pinch, never a swipe.
              swipeStart.current =
                swipes &&
                !sliding.current &&
                event.pointerType === 'touch' &&
                event.isPrimary
                  ? { x: event.clientX, y: event.clientY }
                  : null
            }}
            onPointerMove={(event) => {
              const start = swipeStart.current
              if (!start || !event.isPrimary) return
              const dx = event.clientX - start.x
              const dy = event.clientY - start.y
              // Follow the finger only once the drag is clearly sideways.
              setSlide(Math.abs(dx) > Math.abs(dy) ? dx : 0, false)
            }}
            onPointerUp={(event) => {
              const start = swipeStart.current
              swipeStart.current = null
              if (!start || !event.isPrimary) return
              const dx = event.clientX - start.x
              const dy = event.clientY - start.y
              const swiped =
                !blocked &&
                Math.abs(dx) >= 50 &&
                Math.abs(dx) >= Math.abs(dy) * 1.5 &&
                (dx < 0 ? onNext : onPrevious)
              if (!swiped) {
                setSlide(0, true)
                return
              }
              // A swipe that began on the letterbox must not also dismiss.
              pressedEmptySpace.current = false
              slide(dx < 0 ? 1 : -1)
            }}
            onPointerCancel={() => {
              pressedEmptySpace.current = false
              if (swipeStart.current) setSlide(0, true)
              swipeStart.current = null
            }}
            onClick={(event) => {
              if (
                pressedEmptySpace.current &&
                event.target === event.currentTarget
              )
                onClose()
              pressedEmptySpace.current = false
            }}
          >
            {children}
          </div>
          <footer className={styles.toolbar}>
            <div className={styles.side}>
              {details && (
                <button
                  type="button"
                  className={styles.icon}
                  onClick={() => setDetailsOpen(true)}
                  aria-label="Image details and actions"
                >
                  <Info size={22} />
                </button>
              )}
            </div>
            <div className={styles.navigation}>
              <button
                type="button"
                className={styles.icon}
                disabled={!onPrevious}
                onClick={() => slide(-1)}
                aria-label={`Previous ${kind}`}
              >
                <ChevronLeft size={24} />
              </button>
              <span className={styles.position}>
                {position} / {count}
              </span>
              <button
                type="button"
                className={styles.icon}
                disabled={!onNext}
                onClick={() => slide(1)}
                aria-label={`Next ${kind}`}
              >
                <ChevronRight size={24} />
              </button>
            </div>
            <div className={styles.side}>
              {onDelete && (
                <button
                  type="button"
                  className={styles.icon}
                  onClick={requestDelete}
                  aria-label={`Move ${kind} to Trash`}
                >
                  <Trash2 size={21} />
                </button>
              )}
            </div>
          </footer>
          <ConfirmDialog
            open={confirming}
            className={styles.confirmation}
            title={`Move this ${kind} to Trash?`}
            message="You can restore it from Trash."
            confirmLabel="Move to Trash"
            onCancel={() => setDeleteId(null)}
            onConfirm={() => {
              if (deleteId !== itemId) return
              setDeleteId(null)
              onDelete?.()
            }}
          />
          {details && (
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetContent
                side="bottom"
                className={styles.details}
                showCloseButton={false}
              >
                <div className={styles.detailsHeader}>
                  <SheetTitle>Image details</SheetTitle>
                  <button
                    type="button"
                    className={styles.icon}
                    onClick={() => setDetailsOpen(false)}
                    aria-label="Close details"
                  >
                    <X size={22} />
                  </button>
                </div>
                {details}
              </SheetContent>
            </Sheet>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
