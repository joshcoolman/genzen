'use client'

import {
  FolderInput,
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
import { cx } from '#/lib/utils'

/** Five, filling the caption's width. A group with fewer members still draws
 *  five cells -- the empty ones ghost, which keeps the row the same shape on
 *  every card and reads as "room for more" rather than as a broken grid. */
const SWATCH_COUNT = 5

interface GroupCardProps {
  group: ImageGroupSummary
  /** The gallery's caption toggle, honoured exactly as an image card does. */
  showInfo?: boolean
  /** How many things are in flight for this group right now -- generations
   *  queued, uploads still sending. Client-derived and passed in, so saying so
   *  costs no round trip and the strip below is never asked to be a spinner. */
  working?: number
  onOpen: (group: ImageGroupSummary) => void
  onRename: (group: ImageGroupSummary) => void
  /** Move every picture into another group and drop this one (#350). Absent
   *  when there is nowhere to move to, which is how the menu item hides -- the
   *  card does not know about the other groups and does not need to. */
  onMove?: (group: ImageGroupSummary) => void
  onDissolve: (group: ImageGroupSummary) => void
  onTrash: (group: ImageGroupSummary) => void
  /** The strip is a toggle: expanded, it keeps its five columns and grows down
   *  through every member (#352). Absent for an empty group -- there is nothing
   *  to disclose. */
  onToggleMembers?: () => void
  expanded?: boolean
  /** Every member, newest first, once the read lands. Undefined while it is in
   *  flight, which draws ghosts at the count the card already knows. */
  members?: Array<string>
  /** Something in the grid is selected (#325). A group cannot join a selection,
   *  so it steps out of the way rather than offering its own verbs. */
  selectionActive?: boolean
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
  working = 0,
  onOpen,
  onRename,
  onMove,
  onDissolve,
  onTrash,
  onToggleMembers,
  expanded = false,
  members,
  selectionActive,
}: GroupCardProps) {
  // Built here rather than read from the gallery's URL map: that map only covers
  // the rows the grid is currently rendering, and a group's members are
  // precisely the rows top level filters out. `imageUrl` is still the only place
  // a URL is constructed, which is the rule that matters.
  const coverId = group.cover_image_id ?? group.preview_image_ids[0]
  const coverUrl = coverId ? imageUrl(coverId, 'thumb') : undefined

  /**
   * The strip: the group's newest members, in the group's own order.
   *
   * **Not a loading state** (#350). Work in flight used to take a slot here,
   * which meant every settle re-composed the row -- five cells shifting one
   * place, twice per image, while the grid around them was already churning.
   * The strip only ever changes now when the pictures change, once, after the
   * work is done. What is happening is said in the caption instead, where
   * saying it moves nothing.
   *
   * The cover is already the picture above; repeating it as the first swatch
   * spends one of five slots on something directly overhead.
   */
  const swatchIds = (
    expanded ? (members ?? group.preview_image_ids) : group.preview_image_ids
  )
    .filter((id) => id !== coverId)
    .slice(0, expanded ? undefined : SWATCH_COUNT)

  /**
   * The row, padded to whole rows of five.
   *
   * Collapsed that is one row, and a null ghosts -- the strip keeps its shape
   * on every card. Expanded it is however many rows the group needs, still five
   * across, so the card grows *down* and nothing about its width or its first
   * row changes (#352). The five you were looking at stay exactly where they
   * were and more appear beneath them.
   *
   * While the read is in flight the length comes from `count`, so the card
   * reaches its final height at once and the grid below it moves one time
   * instead of twice.
   */
  const target = expanded
    ? Math.max(group.count - (coverId ? 1 : 0), swatchIds.length)
    : SWATCH_COUNT
  const rows = Math.max(1, Math.ceil(target / SWATCH_COUNT))
  const swatchSlots: Array<string | null> = Array.from(
    { length: rows * SWATCH_COUNT },
    (_, i) => swatchIds[i] ?? null,
  )

  const swatchRow = swatchSlots.map((id, i) => (
    <span
      key={id ?? `empty-${i}`}
      className={id ? styles.swatch : styles.swatchEmpty}
      style={
        id ? { backgroundImage: `url(${imageUrl(id, 'thumb')})` } : undefined
      }
      aria-hidden="true"
    />
  ))

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
          <Pencil />
          Rename
        </DropdownMenuItem>
        {/* Move to group, not Merge (#350): it reads as an action on the
            images, which is what it is -- they go to the destination and this
            group, having nothing left, goes away. Absent when there is nowhere
            to move to. */}
        {onMove && (
          <DropdownMenuItem onClick={() => onMove(group)}>
            <FolderInput />
            Move to group
          </DropdownMenuItem>
        )}
        {/* The non-destructive twin of the delete icon: same group gone, every
            picture kept and returned to top level. Both are offered because "I
            am done with this grouping" and "I am done with these images" are
            different intentions.

            "Ungroup", not "Dissolve" -- dissolve sounds like the images go with
            it, which is precisely what this one does not do. It also pairs with
            "Remove from group" on an image, which is the same act on one. */}
        <DropdownMenuItem onClick={() => onDissolve(group)}>
          <Unlink />
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
      /* Dimmed and inert while a selection is up, the same way an unselected
         image card is. A group can never be part of the selection, and opening
         one navigates *and* drops the selection on the way in -- so a stray
         click here used to throw away the picking that was in progress. */
      dimmed={selectionActive}
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : deleteButton}
      /* Blank, deliberately. An empty group said so in white text under a
         folder icon, which glared -- and said nothing the card was not already
         saying twice, in the name and in "0 images". Still a fallback rather
         than none, because without one the tile renders a loading skeleton and
         an empty group is not loading. */
      fallback={<div className={styles.empty} />}
      /* The slot an image card fills with the model name. Same corner, same
         register: it says what kind of thing the picture is standing for. */
      imageOverlay={<span className={styles.kind}>Image group</span>}
      onClick={selectionActive ? undefined : () => onOpen(group)}
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
            {/* The whole report that a group you are not standing in is busy
                (#350), and it is one line of text on purpose: it can change
                every few seconds without moving a pixel of the row below. */}
            <span className={styles.total}>
              {group.count} {group.count === 1 ? 'image' : 'images'}
              {working > 0 && (
                <span className={styles.working}>, {working} working</span>
              )}
            </span>
          </div>
          {/* The row is the toggle (#352). A button rather than the card's own
              click, which opens the group -- looking at what is in there and
              going in there are different intentions, and the strip is the
              part already about the contents. `stopPropagation` because it
              sits inside the card's click target.

              With nothing to disclose it stays a plain div, so the click falls
              through to opening the group as it always did. A disabled button
              would make an empty group's strip dead space instead. */}
          {onToggleMembers ? (
            <button
              type="button"
              className={cx(
                styles.swatches,
                expanded && styles.swatchesExpanded,
              )}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Hide the contents of ${group.name}`
                  : `Show all ${group.count} images in ${group.name}`
              }
              onClick={(e) => {
                e.stopPropagation()
                onToggleMembers()
              }}
            >
              {swatchRow}
            </button>
          ) : (
            <div className={styles.swatches}>{swatchRow}</div>
          )}
        </div>
      )}
    </Thumbnail>
  )
}
