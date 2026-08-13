'use client'

import {
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Unlink,
} from 'lucide-react'
import styles from './group-card.module.css'
import type { ImageGroupSummary } from '../../_hooks/use-groups'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
  Thumbnail,
} from '#/components'
import { imageUrl } from '#/lib/image-url'

/** Four pictures and a count, filling the caption's width as five cells. The
 *  swatches say "there is more here"; the count says how much more, which four
 *  squares alone cannot -- a group of six and a group of sixty looked
 *  identical. */
const SWATCH_COUNT = 4

interface GroupCardProps {
  group: ImageGroupSummary
  /** The gallery's caption toggle, honoured exactly as an image card does. */
  showInfo?: boolean
  onOpen: (group: ImageGroupSummary) => void
  onRename: (group: ImageGroupSummary) => void
  onDissolve: (group: ImageGroupSummary) => void
  onTrash: (group: ImageGroupSummary) => void
}

/**
 * A group in the grid, and it is **an image card with three deviations** --
 * not a card of its own kind.
 *
 * Same contained image at its natural ratio, same two overlay icons, same grey
 * caption block. What differs: the corner that names the model says
 * `Image group`, the caption's text is the group's name rather than a prompt,
 * and a row of member swatches sits under it in the grey.
 *
 * It was briefly its own shape -- cover-cropped, forced square, swatches
 * floating over the picture -- and next to its neighbours it read as a
 * different species rather than as one of them carrying something extra. Same
 * but different in a couple of easily-identified ways is the whole job.
 *
 * The image shown is the group's cover, falling back to its newest member, so a
 * group whose frozen cover was trashed re-covers itself rather than rendering a
 * hole.
 */
export function GroupCard({
  group,
  showInfo = true,
  onOpen,
  onRename,
  onDissolve,
  onTrash,
}: GroupCardProps) {
  // Built here rather than read from the gallery's URL map: that map only covers
  // the rows the grid is currently rendering, and a group's members are
  // precisely the rows top level filters out. `imageUrl` is still the only place
  // a URL is constructed, which is the rule that matters.
  const coverId = group.cover_image_id ?? group.preview_image_ids[0]
  const coverUrl = coverId ? imageUrl(coverId, 'thumb') : undefined

  // The cover is already the picture above; repeating it as the first swatch
  // spends one of four slots on something directly overhead.
  const swatchIds = group.preview_image_ids
    .filter((id) => id !== coverId)
    .slice(0, SWATCH_COUNT)

  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ExpandableIconButton
            icon={<MoreHorizontal className={styles.menuIcon} />}
            label="Group actions"
          />
        }
      />
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onRename(group)}>
          <Pencil className={styles.menuItemIcon} />
          Rename
        </DropdownMenuItem>
        {/* Dissolve is the non-destructive twin of the delete icon: same group
            gone, every picture kept and returned to top level. Both are offered
            because "I am done with this grouping" and "I am done with these
            images" are different intentions. */}
        <DropdownMenuItem onClick={() => onDissolve(group)}>
          <Unlink className={styles.menuItemIcon} />
          Dissolve group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const deleteButton = (
    <ExpandableIconButton
      icon={<Trash2 className={styles.actionIcon} />}
      label="Trash group"
      variant="destructive"
      onClick={() => onTrash(group)}
    />
  )

  return (
    <Thumbnail
      url={coverUrl}
      alt={group.name}
      status="complete"
      objectFit="contain"
      alwaysShowOverlay
      overlayActionsLeft={moreButton}
      overlayActions={deleteButton}
      /* An empty group is a real state, not a broken one: naming one before
         there is anything in it is how you start working in it. So it says so,
         rather than showing the generic missing-image fallback. */
      fallback={
        <div className={styles.empty}>
          <FolderOpen className={styles.emptyIcon} aria-hidden="true" />
          <span>Empty group</span>
        </div>
      }
      /* The slot an image card fills with the model name. Same corner, same
         register: it says what kind of thing the picture is standing for. */
      imageOverlay={<span className={styles.kind}>Image group</span>}
      onClick={() => onOpen(group)}
    >
      {showInfo && (
        <div className={styles.caption}>
          <span className={styles.name}>{group.name}</span>
          <div className={styles.swatches}>
            {swatchIds.map((id) => (
              <span
                key={id}
                className={styles.swatch}
                style={{ backgroundImage: `url(${imageUrl(id, 'thumb')})` }}
                aria-hidden="true"
              />
            ))}
            {/* The last cell, in the same rhythm as the swatches rather than
                as a label beside them -- it is one of the row, so it reads
                without being announced. Rendered even for an empty group,
                where "0" is the only thing the row has to say. */}
            <span className={styles.total}>
              <span className={styles.totalCircle}>{group.count}</span>
            </span>
          </div>
        </div>
      )}
    </Thumbnail>
  )
}
