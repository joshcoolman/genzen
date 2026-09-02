'use client'

import { MoreHorizontal, Pencil, Trash2, Unlink } from 'lucide-react'
import styles from './video-group-card.module.css'
import type { ImageGroupSummary } from '#/features/groups/hooks/use-groups'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
} from '#/components'
import { imageUrl } from '#/lib/image-url'

/** Five across, matching `GroupCard`'s row exactly. Fewer members still draw
 *  five cells -- the empty ones ghost, so the row is the same shape on every
 *  card and reads as room for more rather than as a broken grid. */
const SWATCH_COUNT = 5

/**
 * A group of clips, sitting in the same wall as the clips themselves (#517).
 *
 * **It borrows the image group card's anatomy and none of its code**, which is
 * `canvas-card.tsx`'s call from #446 applied again: sharing would mean a prop
 * that turns half of `GroupCard` off. What is actually different is small --
 * no Move to group, no `Thumbnail` primitive underneath, a different cover
 * shape -- and copying sixty lines is cheaper than a component with two owners
 * and a switch in the middle.
 *
 * **It deliberately looks like a group, not like a clip.** A clip card is a
 * player: a play button, native controls, two end frames flush underneath,
 * Download and Delete in the caption. This has none of that -- it is stills,
 * and the only thing to press is the card. That difference is what says "this
 * is eleven things, not one" before shape enters into it, which is the whole
 * job of the card.
 *
 * **And it still reads as video.** The cover is 16:9, edge to edge, cropped --
 * the shape people mean when they say video, and wider than the image group
 * card's tile. The point of not simply reusing that tile is that a square
 * cover in the clip wall would read as an image group that had wandered onto
 * the wrong route.
 *
 * **Cropped on purpose, both in the cover and in the swatches.** A frame is a
 * still from a clip whose shape is already stated on every clip card beside
 * it; here the frames are standing in for a *set*, and a uniform grid is what
 * makes the volume legible. Letterboxing five 21:9 frames into square cells
 * would spend most of the row on bars.
 *
 * **The swatches are square**, which is the image group card's row unchanged.
 * They are a count you can see rather than five pictures to study -- the cover
 * is the one you look at.
 */
export function VideoGroupCard({
  group,
  expanded,
  members,
  onOpen,
  onRename,
  onDissolve,
  onTrash,
  onToggleMembers,
  working,
  hidden,
}: {
  group: ImageGroupSummary
  /** Whether the strip is showing every member rather than the first five. */
  expanded: boolean
  /** The full member list, once fetched. Undefined until the strip is opened. */
  members: Array<string> | undefined
  onOpen: (group: ImageGroupSummary) => void
  onRename: (group: ImageGroupSummary) => void
  onDissolve: (group: ImageGroupSummary) => void
  onTrash: (group: ImageGroupSummary) => void
  /** Absent when there is nothing to disclose, which leaves the row a plain
   *  div so the click falls through to opening the group. */
  onToggleMembers?: () => void
  /** Clips of this group still generating. One line of text, so it can change
   *  every few seconds without moving a pixel of the row below (#350). */
  working: number
  /** How many of its clips are hidden (#546). The bar above the wall reports
   *  only what is hidden where you are standing, so without this a clip hidden
   *  inside a group is invisible from out here with nothing saying so. */
  hidden: number
}) {
  // Built here rather than read from a URL map: a group's members are exactly
  // the rows the top-level wall filters out. `imageUrl` stays the only place a
  // URL is constructed.
  const coverId = group.cover_image_id ?? group.preview_image_ids[0]

  // The cover is already the picture above; repeating it as the first swatch
  // spends one of five slots on something directly overhead.
  const swatchIds = (
    expanded ? (members ?? group.preview_image_ids) : group.preview_image_ids
  )
    .filter((id) => id !== coverId)
    .slice(0, expanded ? undefined : SWATCH_COUNT)

  // Padded to whole rows of five, so the card grows *down* when it expands and
  // the five you were looking at stay where they were. While the member read
  // is in flight the length comes from `count`, so the card reaches its final
  // height once instead of twice.
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

  return (
    <article className={styles.item}>
      {/* The whole cover is the way in, matching the image group card, where
          the tile is the click target and the caption's strip is not. */}
      <button
        type="button"
        className={styles.stage}
        onClick={() => onOpen(group)}
        aria-label={`Open ${group.name}`}
      >
        {coverId ? (
          <img
            className={styles.cover}
            src={imageUrl(coverId, 'thumb')}
            alt=""
          />
        ) : (
          /* An empty group draws the backing and nothing else. It said so in
             white text under a folder icon on the image card once, which
             glared and repeated what the name and "0 clips" already say. */
          <span className={styles.coverEmpty} />
        )}
        {/* The slot a clip card fills with the model name -- same corner, same
            size, same register: it says what kind of thing the picture is
            standing for. */}
        <span className={styles.badge}>Video group</span>
      </button>

      {/* Top-left, where the clip card puts its select tick: the two cards do
          not share a verb, so they can share the corner. A group is never part
          of a selection, so nothing collides. */}
      <div className={styles.menu}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ExpandableIconButton
                icon={<MoreHorizontal className={styles.menuIcon} />}
                label="Group actions"
              />
            }
          />
          <DropdownMenuContent
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onClick={() => onRename(group)}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            {/* "Ungroup", not "Dissolve" -- dissolve sounds like the clips go
                with it, which is precisely what this one does not do. */}
            <DropdownMenuItem onClick={() => onDissolve(group)}>
              <Unlink />
              Ungroup
            </DropdownMenuItem>
            {/* Last, after the two that keep the clips, and guarded by a
                confirm that names the group and counts them. Not red: the
                clips go to Trash and come back from it, and red belongs to
                Delete Forever. */}
            <DropdownMenuItem
              className={styles.destructive}
              onClick={() => onTrash(group)}
            >
              <Trash2 />
              Move to trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={styles.caption}>
        <div className={styles.heading}>
          <span className={styles.name}>{group.name}</span>
          <span className={styles.total}>
            {group.count} {group.count === 1 ? 'clip' : 'clips'}
            {working > 0 && (
              <span className={styles.working}>, {working} working</span>
            )}
            {/* After working, in the same grey: a fact about the group that
                stays true until you change it, not news. */}
            {hidden > 0 && <span>, {hidden} hidden</span>}
          </span>
        </div>
        {/* The row is the toggle (#352): looking at what is in there and going
            in there are different intentions, and the strip is the part
            already about the contents. With nothing to disclose it stays a
            plain div rather than a disabled button, which would make an empty
            group's row dead space. */}
        {onToggleMembers ? (
          <button
            type="button"
            className={styles.swatches}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Hide the contents of ${group.name}`
                : `Show all ${group.count} clips in ${group.name}`
            }
            onClick={onToggleMembers}
          >
            {swatchRow}
          </button>
        ) : (
          <div className={styles.swatches}>{swatchRow}</div>
        )}
      </div>
    </article>
  )
}
