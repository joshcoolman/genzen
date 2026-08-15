import { CardCaption } from '../card-caption/card-caption'
import { Thumbnail } from '#/components'

interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
  sourceImageUrl?: string
  onDelete?: () => void
}

/**
 * A generation that has not landed yet, drawn to become `ImageCard` without
 * moving anything (#367).
 *
 * The model used to be the caption's first line, above the prompt, while a
 * finished card carries it in the picture's bottom-right corner -- so the one
 * label you watch while waiting jumped across the card at the moment the
 * picture arrived. It is the same badge in the same place now, and the caption
 * is the prompt alone in both states. What changes on settle is the picture.
 *
 * The spinner keeps the tile honest about being unfinished; it no longer
 * repeats the model underneath itself, which was the same word twice.
 */
export function PendingImageCard({
  prompt,
  model,
  isVariation,
  sourceImageUrl,
  onDelete,
}: PendingImageCardProps) {
  return (
    <Thumbnail
      status="pending"
      bottomRightBadge={model}
      pendingBackgroundUrl={sourceImageUrl}
      topLeftBadge={isVariation ? 'Variation' : undefined}
      onDelete={onDelete}
      alwaysShowOverlay={!!onDelete}
    >
      {/* The same component the finished card renders, so the text cannot
          change size, colour, clamp or behaviour when the picture lands. Only
          when there is one: generating from a picture with no prompt has
          nothing to caption, and an empty block would give the card a height
          its finished self does not have. */}
      {prompt && <CardCaption text={prompt} />}
    </Thumbnail>
  )
}
