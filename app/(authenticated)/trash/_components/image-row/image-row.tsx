'use client'

import { CheckCircle2, Circle, RotateCcw, X } from 'lucide-react'
import styles from './image-row.module.css'
import type { UserImage } from '#/features/user-images/types'
import { Button, ConfirmDialog, MediaBox, useConfirm } from '#/components'
import { formatFileSize } from '#/lib/format'

const THUMB_SIZE = 96

function formatDeletedDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

interface ImageRowProps {
  image: UserImage
  url: string | null
  selected: boolean
  /** Hides the per-row actions: a selection is running, and the drawer owns
   *  the verbs while it is. */
  hasSelection: boolean
  busy: boolean
  onToggle: (id: string, shiftKey: boolean) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

export function ImageRow({
  image,
  url,
  selected,
  hasSelection,
  busy,
  onToggle,
  onRestore,
  onDelete,
}: ImageRowProps) {
  const { confirm, dialogProps } = useConfirm()
  const isVideo = image.source === 'ai_video'

  async function askThenDelete() {
    const ok = await confirm({
      title: 'Delete forever?',
      message: `“${image.title}” will be permanently deleted. This action cannot be undone.`,
      confirmLabel: 'Delete Forever',
    })
    if (ok) onDelete(image.id)
  }

  return (
    <div
      className={selected ? styles.rowSelected : styles.row}
      onClick={(e) => onToggle(image.id, e.shiftKey)}
    >
      {selected ? (
        <CheckCircle2 className={styles.checkOn} />
      ) : (
        <Circle className={styles.checkOff} />
      )}

      {/* The card is the bordered surface. It was Thumbnail's list-layout root
          until ImageBox took over the picture; the row draws it now, because
          the row is what it is a card of. */}
      <div className={styles.card}>
        {/* MediaBox rather than a hand-rolled `<video>` (#398). This row wrote
            the decision first, the Video card had already written it, and
            Activity was about to be the third -- so it is a component now. */}
        <MediaBox
          kind={isVideo ? 'video' : 'image'}
          src={url}
          alt={image.title}
          size={THUMB_SIZE}
        />

        <div className={styles.text}>
          <div className={styles.titleRow}>
            <p className={styles.title}>{image.title}</p>
          </div>
          <p className={styles.meta}>
            {isVideo
              ? 'Video'
              : image.source === 'ai_generated'
                ? 'AI'
                : 'Upload'}
            {' -- '}
            {formatFileSize(image.file_size ?? 0)}
            {' -- '}
            Deleted {formatDeletedDate(image.deleted_at)}
          </p>
        </div>

        {!hasSelection && (
          <div className={styles.actions}>
            {/* Delete first, then Restore, and the order is deliberate:
                Restore is the button you click many times in a row -- down a
                list of things you want back -- so it has to sit in the same
                place on every row. Appending Delete after it would move
                Restore under a finger that is repeating a Restore click. */}
            <Button
              variant="ghost"
              size="sm"
              className={styles.deleteButton}
              disabled={busy}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                void askThenDelete()
              }}
            >
              <X className={styles.buttonIcon} />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onRestore(image.id)
              }}
            >
              <RotateCcw className={styles.buttonIcon} />
              Restore
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
