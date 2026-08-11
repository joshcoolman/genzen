'use client'

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
 * circle (select mode does), and the source highlight (the generator's chip is
 * the only place the source is shown or changed).
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

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      alwaysShowOverlay
      selected={selected}
      selectedClassName={styles.selectedTile}
      overlayActionsLeft={selectionActive ? undefined : moreButton}
      overlayActions={selectionActive ? undefined : deleteButton}
      imageOverlay={
        <>
          {/* Passive, and that is the whole point (#216): trashing an image
              that is arranged on the canvas takes it off a surface you are not
              looking at. Saying so on the card prevents the surprise instead of
              interrupting to explain it. */}
          {img.on_canvas && (
            <span className={styles.onCanvas}>
              <Frame className={styles.onCanvasIcon} aria-hidden="true" />
              On canvas
            </span>
          )}
          {/* The tick the select circle used to carry, in the corner it used to
              sit in. The border says "selected" too, but only against its
              neighbours -- a card selected on its own has nothing to compare
              to. */}
          {selectionActive && selected && (
            <CheckCircle2 className={styles.selectTick} aria-hidden="true" />
          )}
        </>
      }
      onClick={selectionActive ? undefined : () => onOpen?.(img)}
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
              label="Copy prompt"
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
