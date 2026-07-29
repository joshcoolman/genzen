import { X } from 'lucide-react'
import styles from './source-image-preview.module.css'

interface SourceImagePreviewProps {
  src: string
  name: string
  onRemove?: () => void
  variant?: 'compact' | 'square'
}

export function SourceImagePreview({
  src,
  name,
  onRemove,
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
      <img src={src} alt="Source" className={styles.compactImage} />
      <span className={styles.compactName}>{name}</span>
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
