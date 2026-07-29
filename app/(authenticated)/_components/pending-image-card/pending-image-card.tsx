import styles from './pending-image-card.module.css'
import { Thumbnail } from '#/components'

interface PendingImageCardProps {
  prompt: string
  model: string
  isVariation?: boolean
  sourceImageUrl?: string
  onDelete?: () => void
}

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
      pendingLabel={model}
      pendingBackgroundUrl={sourceImageUrl}
      topLeftBadge={isVariation ? 'Variation' : undefined}
      onDelete={onDelete}
      alwaysShowOverlay={!!onDelete}
    >
      <p className={styles.model}>{model}</p>
      <p className={styles.prompt}>{prompt}</p>
    </Thumbnail>
  )
}
