import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { mediaUrl } from '../../_lib/types'
import styles from './session-card.module.css'
import type { SessionSummary } from '../../_lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
} from '#/components'

export function SessionCard({
  session,
  onOpen,
  onRename,
  onDelete,
}: {
  session: SessionSummary
  onOpen: (session: SessionSummary) => void
  onRename: () => void
  onDelete: () => void
}) {
  const [cover, ...thumbnails] = session.thumbnails
  return (
    <article className={styles.card}>
      <button
        className={styles.cover}
        onClick={() => onOpen(session)}
        aria-label={`Open ${session.name}`}
      >
        {cover && <img src={mediaUrl(cover)} alt="" loading="lazy" />}
      </button>
      <div className={styles.menu}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ExpandableIconButton
                icon={<MoreHorizontal size={16} />}
                label="Session actions"
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
              Delete session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={styles.caption}>
        <button onClick={() => onOpen(session)}>{session.name}</button>
        <p>
          {session.count} {session.count === 1 ? 'clip' : 'clips'}
          {session.pending ? ' · generating' : ''}
        </p>
        <div className={styles.strip} aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i}>
              {thumbnails[i] && (
                <img src={mediaUrl(thumbnails[i])} alt="" loading="lazy" />
              )}
            </span>
          ))}
        </div>
        <time dateTime={session.updated_at}>
          {new Date(session.updated_at).toISOString().slice(0, 10)}
        </time>
      </div>
    </article>
  )
}
