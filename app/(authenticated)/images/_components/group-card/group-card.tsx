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

interface GroupCardProps {
  group: ImageGroupSummary
  onOpen: (group: ImageGroupSummary) => void
  onRename: (group: ImageGroupSummary) => void
  onDissolve: (group: ImageGroupSummary) => void
  onTrash: (group: ImageGroupSummary) => void
}

/**
 * A group in the grid: cover, a strip of member swatches, a count, a name.
 *
 * It sits among the image cards rather than in a section of its own, because a
 * group is a lens on the same library and not a second place. What makes it
 * legible as a group is the swatch strip -- it reads as texture at a glance,
 * where a "Group" label would be text to parse. So there is no label.
 *
 * The cover is whatever the group says, falling back to its newest member: a
 * group whose frozen cover was trashed re-covers itself rather than rendering a
 * hole, and one that has never had a cover set still shows a picture.
 */
export function GroupCard({
  group,
  onOpen,
  onRename,
  onDissolve,
  onTrash,
}: GroupCardProps) {
  // Built here rather than read from the gallery's URL map: that map only
  // covers the rows the grid is currently rendering, and a group's members are
  // precisely the rows top level filters out. `imageUrl` is still the only
  // place a URL is constructed, which is the rule that matters.
  const coverId = group.cover_image_id ?? group.preview_image_ids[0]
  const coverUrl = coverId ? imageUrl(coverId, 'thumb') : undefined

  // The cover is already the hero; showing it again as the first swatch wastes
  // one of four or five slots on a picture that is directly above it.
  const swatchIds = group.preview_image_ids
    .filter((id) => id !== coverId)
    .slice(0, 4)

  const menu = (
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
        {/* Dissolve is the non-destructive twin of the delete icon: same
            group gone, every picture kept and returned to top level. Both are
            offered because "I am done with this grouping" and "I am done with
            these images" are different intentions. */}
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
      objectFit="cover"
      alwaysShowOverlay
      className={styles.card}
      overlayActionsLeft={menu}
      overlayActions={deleteButton}
      /* An empty group is a real state, not a broken one: naming it before
         there is anything in it is how you start working in one. So it says so
         rather than showing the generic missing-image fallback. */
      fallback={
        <div className={styles.empty}>
          <FolderOpen className={styles.emptyIcon} aria-hidden="true" />
          <span>Empty group</span>
        </div>
      }
      imageOverlay={
        <div className={styles.strip}>
          <div className={styles.swatches}>
            {swatchIds.map((id) => (
              <span
                key={id}
                className={styles.swatch}
                style={{ backgroundImage: `url(${imageUrl(id, 'thumb')})` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className={styles.count}>{group.count}</span>
        </div>
      }
      onClick={() => onOpen(group)}
    >
      <div className={styles.caption}>
        <span className={styles.name}>{group.name}</span>
      </div>
    </Thumbnail>
  )
}
