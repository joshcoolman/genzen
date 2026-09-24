import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import styles from './edit-card.module.css'
import type { EditSummary } from '../../_lib/types'
import { imageUrl } from '#/lib/image-url'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
} from '#/components'

/** Director's session card, for an edit: the same cover, strip and menu. */
export function EditCard({
  edit,
  onOpen,
  onRename,
  onDelete,
}: {
  edit: EditSummary
  onOpen: (edit: EditSummary) => void
  onRename: () => void
  onDelete: () => void
}) {
  const [cover, ...thumbnails] = edit.thumbnails
  return (
    <article className={styles.card}>
      <button
        className={styles.cover}
        onClick={() => onOpen(edit)}
        aria-label={`Open ${edit.name}`}
      >
        {cover && <img src={imageUrl(cover, 'thumb')} alt="" loading="lazy" />}
      </button>
      <div className={styles.menu}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ExpandableIconButton
                icon={<MoreHorizontal size={16} />}
                label="Edit actions"
              />
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onRename}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 />
              Delete edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={styles.caption}>
        <button onClick={() => onOpen(edit)}>{edit.name}</button>
        <p>
          {edit.count} {edit.count === 1 ? 'clip' : 'clips'}
          {edit.count > 0 && ` · ${formatSeconds(edit.seconds)}`}
        </p>
        <div className={styles.strip} aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i}>
              {thumbnails[i] && (
                <img
                  src={imageUrl(thumbnails[i], 'thumb')}
                  alt=""
                  loading="lazy"
                />
              )}
            </span>
          ))}
        </div>
        <time dateTime={edit.updated_at}>
          {new Date(edit.updated_at).toISOString().slice(0, 10)}
        </time>
      </div>
    </article>
  )
}

/** `0:07`, `1:23` -- a cut's length reads as a clock, not a count. */
export function formatSeconds(seconds: number): string {
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}
