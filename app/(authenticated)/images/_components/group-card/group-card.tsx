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

/** Five, filling the caption's width. A group with fewer members still draws
 *  five cells -- the empty ones ghost, which keeps the row the same shape on
 *  every card and reads as "room for more" rather than as a broken grid. */
const SWATCH_COUNT = 5

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
  // spends one of five slots on something directly overhead.
  const swatchIds = group.preview_image_ids
    .filter((id) => id !== coverId)
    .slice(0, SWATCH_COUNT)

  // Padded to a fixed five so the row never reflows: a null is a ghosted slot.
  const swatchSlots: Array<string | null> = Array.from(
    { length: SWATCH_COUNT },
    (_, i) => (i < swatchIds.length ? swatchIds[i] : null),
  )

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
        {/* The non-destructive twin of the delete icon: same group gone, every
            picture kept and returned to top level. Both are offered because "I
            am done with this grouping" and "I am done with these images" are
            different intentions.

            "Ungroup", not "Dissolve" -- dissolve sounds like the images go with
            it, which is precisely what this one does not do. It also pairs with
            "Remove from group" on an image, which is the same act on one. */}
        <DropdownMenuItem onClick={() => onDissolve(group)}>
          <Unlink className={styles.menuItemIcon} />
          Ungroup
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
          {/* Name and count on one line, the count right-aligned. It sat in the
              row of swatches as a fifth cell first, which cost a picture and
              made the count look like a thumbnail. It belongs with the name:
              both are what this group *is*, and the row below is what is in
              it. */}
          <div className={styles.heading}>
            <span className={styles.name}>{group.name}</span>
            <span className={styles.total}>
              {group.count} {group.count === 1 ? 'image' : 'images'}
            </span>
          </div>
          <div className={styles.swatches}>
            {swatchSlots.map((id, i) => (
              <span
                key={id ?? `empty-${i}`}
                className={id ? styles.swatch : styles.swatchEmpty}
                style={
                  id
                    ? { backgroundImage: `url(${imageUrl(id, 'thumb')})` }
                    : undefined
                }
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      )}
    </Thumbnail>
  )
}
