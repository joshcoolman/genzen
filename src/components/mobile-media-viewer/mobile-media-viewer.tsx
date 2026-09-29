'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, Info, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog'
import { Sheet, SheetContent, SheetTitle } from '../sheet/sheet'
import styles from './mobile-media-viewer.module.css'
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { cx } from '#/lib/utils'

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
        if (event.key === 'ArrowLeft') onPrevious?.()
        else onNext?.()
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
  }, [blocked, itemId, onDelete, onPrevious, onNext, onTogglePlayback])

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
            onPointerDown={(event) => {
              pressedEmptySpace.current = event.target === event.currentTarget
              // A second finger is a pinch, never a swipe.
              swipeStart.current =
                swipes && event.pointerType === 'touch' && event.isPrimary
                  ? { x: event.clientX, y: event.clientY }
                  : null
            }}
            onPointerUp={(event) => {
              const start = swipeStart.current
              swipeStart.current = null
              if (!start || !event.isPrimary || blocked) return
              const dx = event.clientX - start.x
              const dy = event.clientY - start.y
              if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
              // A swipe that began on the letterbox must not also dismiss.
              pressedEmptySpace.current = false
              if (dx < 0) onNext?.()
              else onPrevious?.()
            }}
            onPointerCancel={() => {
              pressedEmptySpace.current = false
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
                onClick={onPrevious}
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
                onClick={onNext}
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
