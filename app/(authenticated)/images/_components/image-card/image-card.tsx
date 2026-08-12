'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Download,
  Frame,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import styles from './image-card.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { useModifierHeld } from '#/lib/use-modifier-held'
import { cx } from '#/lib/utils'
import {
  CopyText,
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
  onDescribe?: (img: SavedAiImage) => void
  onGenerateVariations?: (img: SavedAiImage) => void
  /** Card click in normal mode: the image opens bigger, which is what reaching
   *  for it in a grid means (#284). */
  onOpen?: (img: SavedAiImage) => void
  /** Cmd/Ctrl-click on the image: add it to the generator's reference images,
   *  evicting the last when the set is full. */
  onAddReference?: (img: SavedAiImage) => void
  /** Cmd/Ctrl-click on the prompt: load it into the generator. */
  onUsePrompt?: (text: string) => void
  selected?: boolean
  /** Select mode. The whole card is the target, and nothing else responds. */
  selectionActive?: boolean
  onSelect?: (id: string, shiftKey: boolean) => void
}

/**
 * Two icons and a caption (#284). `...` and Delete on the image; the model name
 * and the whole prompt under it, the prompt being its own copy button.
 *
 * Everything else went: the expand icon (the click does that now), the select
 * circle (select mode does), and the source highlight -- there is no source to
 * highlight since #297, only the generator's set.
 */
export function ImageCard({
  img,
  imageUrl,
  objectFit,
  showInfo = true,
  onDelete,
  onDownload,
  onDescribe,
  onGenerateVariations,
  onOpen,
  onAddReference,
  onUsePrompt,
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
            <Download className={styles.menuItemIcon} />
            Download
          </DropdownMenuItem>
        )}
        {onDescribe && (
          <DropdownMenuItem onClick={() => onDescribe(img)}>
            <MessageSquare className={styles.menuItemIcon} />
            Describe
          </DropdownMenuItem>
        )}
        {onGenerateVariations && img.status === 'completed' && (
          <DropdownMenuItem onClick={() => onGenerateVariations(img)}>
            <Layers className={styles.menuItemIcon} />
            Generate Variations
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

  const caption = img.description ?? img.generation_metadata?.prompt

  // The image's shortcut names itself the moment the key goes down, the way
  // the prompt's hint does. Only while this card is hovered -- see
  // `useModifierHeld`.
  const [hovered, setHovered] = useState(false)
  const watching = hovered && !selectionActive
  const modifier = useModifierHeld(watching)
  const shortcut = watching && modifier.meta && onAddReference ? 'Add' : null

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      alwaysShowOverlay
      selected={selected}
      selectedClassName={styles.selectedTile}
      /* Entering select mode dims the whole grid, because nothing is picked
         yet -- the mode announcing itself. After that it answers "which ones
         did I take" from across the grid, which a 20px corner glyph cannot.
         `dimmed` rather than a local class: it is already 50% on the tile
         root, where nothing transitions, and the image itself carries a
         load-fade transition that would have eased this too. */
      dimmed={selectionActive && !selected}
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : deleteButton}
      imageOverlay={
        <>
          {/* Bottom-centre, stacked in one column so neither moves when the
              other appears, and absolutely positioned so neither costs the
              card any layout. */}
          <div className={styles.markers}>
            {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
            {/* Passive, and that is the whole point (#216): trashing an image
                that is arranged on the canvas takes it off a surface you are
                not looking at. Saying so on the card prevents the surprise
                instead of interrupting to explain it. */}
            {img.on_canvas && (
              <span className={styles.onCanvas}>
                <Frame className={styles.onCanvasIcon} aria-hidden="true" />
                On canvas
              </span>
            )}
          </div>
          {/* The tick the select circle used to carry, in the corner it used to
              sit in -- on every card while the mode is on, grey until it is
              taken. The border says "selected" too, but only against its
              neighbours; a card selected on its own has nothing to compare
              to. */}
          {selectionActive && (
            <CheckCircle2
              className={cx(styles.selectTick, selected && styles.selectTickOn)}
              aria-hidden="true"
            />
          )}
        </>
      }
      /* Plain click opens it bigger; Cmd adds it to the reference images. One
         modifier, not two: Cmd used to replace the first image and Cmd-Shift
         push onto the rest, which was a real distinction only while a source
         slot existed to be replaced. Over one set (#297) they were the same
         gesture with a rule to remember, so Cmd-click just adds -- click again
         for a second, and a full set pops the last to make room.

         The modifier is the whole path back from the grid to the generator,
         which #284 removed on purpose -- it is here as its own decision, and it
         costs the card nothing because it is not a control. */
      onMouseEnter={(e) => {
        setHovered(true)
        modifier.seed(e)
      }}
      onMouseLeave={() => setHovered(false)}
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
      {showInfo && (
        <div className={styles.caption}>
          <p className={styles.title}>{img.title}</p>
          {/* Not truncated (#284): the point of a caption is reading what made
              something without opening it. Uneven card heights are the known
              cost, being tried before a clamp is reached for again. */}
          {caption && (
            <CopyText
              text={caption}
              label="Copy"
              onModifierClick={selectionActive ? undefined : onUsePrompt}
              modifierLabel="Load Prompt"
              className={styles.prompt}
              textClassName={styles.promptText}
            />
          )}
        </div>
      )}

      {/* Select mode makes the whole card one target -- the caption too, since
          bulk selection is the use that justifies the mode and a click that
          misses by landing on text is the failure it exists to avoid. */}
      {selectionActive && onSelect && (
        <div
          className={styles.selectOverlay}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(img.id, e.shiftKey)
          }}
        />
      )}
    </Thumbnail>
  )
}
