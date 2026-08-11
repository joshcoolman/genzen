import { X } from 'lucide-react'
import styles from './source-image-preview.module.css'

interface SourceImagePreviewProps {
  src: string
  name: string
  onRemove?: () => void
  /** Compact only. Clicking the chip anywhere but the X picks another source. */
  onPick?: () => void
  variant?: 'compact' | 'square'
}

/**
 * The image a generation is working from.
 *
 * The compact chip is the only place the source is shown and the only place it
 * is changed (#284). It carries no title: the name it had was usually the
 * source image's model, unrelated to the model currently selected, so it read
 * as a claim about the wrong thing. The image says what is focused.
 */
export function SourceImagePreview({
  src,
  name,
  onRemove,
  onPick,
  variant = 'compact',
}: SourceImagePreviewProps) {
  if (variant === 'square') {
    return (
      <div className={styles.square}>
        <img src={src} alt={name} className={styles.squareImage} />
        {onRemove && (
          <button
            onClick={onRemove}
            className={styles.squareRemove}
            title="Remove source image"
          >
            <X className={styles.removeIcon} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.compact}>
      {onPick ? (
        <button
          type="button"
          onClick={onPick}
          className={styles.compactPick}
          title="Change source image"
        >
          <img src={src} alt="Source" className={styles.compactImage} />
          <span className={styles.compactHint}>Change</span>
        </button>
      ) : (
        <img src={src} alt="Source" className={styles.compactImage} />
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className={styles.compactRemove}
          title="Remove source image"
        >
          <X className={styles.removeIcon} />
        </button>
      )}
    </div>
  )
}
