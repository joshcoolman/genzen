'use client'

import {
  CheckCircle2,
  Clapperboard,
  Download,
  FolderMinus,
  FolderPlus,
  ImageIcon,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { CardCaption } from '../card-caption/card-caption'
import styles from './image-card.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { refUsageNote } from '#/features/ai-images/ref-usage'
import { cx } from '#/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
  Thumbnail,
} from '#/components'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  objectFit?: 'contain' | 'cover'
  showInfo?: boolean
  onDelete?: (img: SavedAiImage) => void
  onDownload?: (img: SavedAiImage) => void
  /** Take this still to /video as the first frame (#305). */
  onAnimate?: (img: SavedAiImage) => void
  /** The card click: opens the lightbox over everything. */
  onOpen?: (img: SavedAiImage) => void
  /** Cmd/Ctrl-click on the image: add it to the generator's reference images,
   *  evicting the last when the set is full. */
  onAddReference?: (img: SavedAiImage) => void
  /** Cmd/Ctrl-click on the prompt: load it into the generator. */
  onUsePrompt?: (text: string) => void
  /** Fill the panel with what produced this image (#382). */
  onLoad?: (img: SavedAiImage) => void
  /** Groups (#319). Opens the picker dialog -- a pop-up rather than a submenu,
   *  because a flyout of group names has no way out: it commits you to picking
   *  one at the exact moment you might realise the group you wanted does not
   *  exist. The dialog has a Cancel, and offers `New group...` in the same
   *  list. */
  onAddToGroup?: (img: SavedAiImage) => void
  /** Set only while the gallery is inside a group -- the two actions that make
   *  no sense from top level, where an image has no group to leave or cover. */
  onRemoveFromGroup?: (img: SavedAiImage) => void
  onSetGroupCover?: (img: SavedAiImage) => void
  selected?: boolean
  /** Select mode. The whole card is the target, and nothing else responds. */
  selectionActive?: boolean
  onSelect?: (id: string, shiftKey: boolean) => void
}

/**
 * Two icons and a caption. `...` and Delete on the image, the model in its
 * bottom-right corner; the whole prompt under it, being its own copy button.
 *
 * The select circle went in #284 (select mode replaced it) and the source
 * highlight in #297 (there is no source, only the generator's set). A pair of
 * Gallery launchers lived in the caption briefly and went once the card click
 * was wired straight to the lightbox.
 */
export function ImageCard({
  img,
  imageUrl,
  objectFit,
  showInfo = true,
  onDelete,
  onDownload,
  onAnimate,
  onOpen,
  onAddReference,
  onUsePrompt,
  onLoad,
  onAddToGroup,
  onRemoveFromGroup,
  onSetGroupCover,
  selected,
  selectionActive,
  onSelect,
}: ImageCardProps) {
  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ExpandableIconButton
            icon={<MoreHorizontal className={styles.menuIcon} />}
            label="More actions"
          />
        }
      />
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {onDownload && (
          <DropdownMenuItem onClick={() => onDownload(img)}>
            <Download />
            Download
          </DropdownMenuItem>
        )}
        {onAnimate && img.status === 'completed' && (
          <DropdownMenuItem onClick={() => onAnimate(img)}>
            <Clapperboard />
            Animate
          </DropdownMenuItem>
        )}

        {/* Groups (#319). One item, opening a dialog -- see `onAddToGroup`. */}
        {onAddToGroup && (
          <DropdownMenuItem onClick={() => onAddToGroup(img)}>
            <FolderPlus />
            Add to group
          </DropdownMenuItem>
        )}

        {/* Only inside a group. `Remove` returns the image to top level and
            deletes nothing; `Set as cover` is the escape hatch for the cover
            being chosen automatically, which is what keeps creation from
            asking. */}
        {onSetGroupCover && (
          <DropdownMenuItem onClick={() => onSetGroupCover(img)}>
            <ImageIcon />
            Set as group cover
          </DropdownMenuItem>
        )}
        {onRemoveFromGroup && (
          <DropdownMenuItem onClick={() => onRemoveFromGroup(img)}>
            <FolderMinus />
            Remove from group
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const deleteButton = onDelete ? (
    <ExpandableIconButton
      icon={<Trash2 className={styles.actionIcon} />}
      label="Delete"
      variant="destructive"
      onClick={() => onDelete(img)}
    />
  ) : undefined

  // An upload has no prompt, so its caption block was empty and its badge
  // carried the filename -- a card with a name in the corner and a blank grey
  // strip under it. The two swap: the badge says what kind of thing this is,
  // the way a generation's badge names the model, and the filename moves down
  // to where the prompt would be. A description still wins if one was written.
  const isUpload = img.origin === 'upload'
  const badge = isUpload ? 'Upload' : img.title
  const caption = isUpload
    ? (img.description ?? img.title)
    : (img.description ?? img.generation_metadata?.prompt)
  // Only when the endpoint could not hold everything it was given (#341). The
  // panel no longer refuses those images, so this is where you find out.
  const refNote = refUsageNote(img.generation_metadata)

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      alwaysShowOverlay
      /* The model, on the image rather than over the caption: it names what
         made *this* picture, so it belongs to the picture. In the caption it
         read as a title for the prompt underneath it. Owned by Thumbnail since
         #367, so a pending card carries the identical badge in the identical
         place and nothing moves when the picture lands. */
      bottomRightBadge={badge}
      selected={selected}
      selectedClassName={styles.selectedTile}
      /* Select mode reads off the border alone: accent when taken, grey when
         not, nothing when the mode is off. The unpicked card used to dim to
         50% instead, which put it in the same state as a group card -- and a
         group genuinely cannot be selected, so the grid was telling you the
         one thing about images that is not true of them. */
      className={
        selectionActive && !selected ? styles.selectableTile : undefined
      }
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : deleteButton}
      imageOverlay={
        <>
          {/* The image used to name its Cmd-click ("Add") while the key was
              held. It went with the "On canvas" marker: the gesture is an
              insider's, and it does not need announcing over every thumbnail
              of a grid. The prompt's own hint still names its modifier -- that
              one sits in a hover surface that already exists. */}
          {refNote && <span className={styles.refNote}>{refNote}</span>}
          {/* The tick, and the way *into* select mode (#325). On every card
              always, not only once the mode is on: it is the only thing saying
              a card can be picked, and a toolbar toggle asked you to turn a
              mode on before you could touch the picture you were looking at.
              Grey until taken. The border says "selected" too, but only
              against its neighbours -- a card selected on its own has nothing
              to compare to.

              Above the full-card overlay, so a click on the tick and a click
              on the card do the same thing once the mode is on. */}
          {onSelect && (
            <button
              type="button"
              className={cx(styles.selectTick, selected && styles.selectTickOn)}
              aria-pressed={selected}
              aria-label={selected ? 'Deselect image' : 'Select image'}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(img.id, e.shiftKey)
              }}
            >
              <CheckCircle2 className={styles.selectTickIcon} />
            </button>
          )}
        </>
      }
      /* Cmd adds it to the reference images. One modifier, not two: Cmd used to
         replace the first image and Cmd-Shift push onto the rest, which was a
         real distinction only while a source slot existed to be replaced. Over
         one set (#297) they were the same gesture with a rule to remember, so
         Cmd-click just adds -- click again for a second, and a full set pops
         the last to make room.

         The modifier is the whole path back from the grid to the generator,
         which #284 removed on purpose -- it is here as its own decision, and it
         costs the card nothing because it is not a control.

         The plain click opens the lightbox. It was briefly a duplicate of a
         launcher button in the caption; the click won and the buttons went. */
      onClick={
        selectionActive
          ? undefined
          : (e) => {
              if ((e?.metaKey || e?.ctrlKey) && onAddReference) {
                onAddReference(img)
                return
              }
              onOpen?.(img)
            }
      }
    >
      {/* Shared with `PendingImageCard`, so a caption cannot change size,
          colour, clamp or behaviour when the picture lands (#367). */}
      {showInfo && caption && (
        <CardCaption
          text={caption}
          onUsePrompt={selectionActive ? undefined : onUsePrompt}
          /* Same gate as `detailId` below, and for the same reason: an upload
             has no generation to load, and in select mode every click belongs
             to the selection. */
          onLoad={
            !isUpload && !selectionActive && onLoad
              ? () => onLoad(img)
              : undefined
          }
          /* Generations only -- an upload has no run in Activity, so the link
             would open a panel about nothing. Absent in select mode for the
             same reason the caption stops being a copy button there: every
             click belongs to the selection. */
          detailId={!isUpload && !selectionActive ? img.id : undefined}
        />
      )}

      {/* Select mode makes the whole card one target -- the caption too, since
          bulk selection is the use that justifies the mode and a click that
          misses by landing on text is the failure it exists to avoid. */}
      {selectionActive && onSelect && (
        <div
          className={styles.selectOverlay}
          /* Also the sweep's hit target (#440). It is exactly the card's
             rectangle and it exists only in select mode, which is the only
             time a sweep can run -- so the selectable set needs no marking of
             its own, and a group, pending or failed card is never found. */
          data-select-id={img.id}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(img.id, e.shiftKey)
          }}
        />
      )}
    </Thumbnail>
  )
}
