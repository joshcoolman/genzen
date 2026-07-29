import { Plus, X } from 'lucide-react'
import styles from './ref-image-strip.module.css'
import { cx } from '#/lib/utils'

interface RefImageStripProps {
  images: Array<{ id: string; url: string; title: string }>
  max: number
  onAdd?: () => void
  onRemove?: (id: string) => void
  onImageClick?: () => void
  disabled?: boolean
  /** Show element label under each thumbnail */
  showLabels?: boolean
}

export function RefImageStrip({
  images,
  max,
  onAdd,
  onRemove,
  onImageClick,
  disabled,
  showLabels,
}: RefImageStripProps) {
  return (
    <div className={cx(styles.root, showLabels && styles.rootLabelled)}>
      {images.map((img) => (
        <div key={img.id} className={styles.item}>
          <div className={styles.frame}>
            <img
              src={img.url}
              alt={img.title}
              className={cx(
                styles.image,
                onImageClick && !disabled && styles.imageClickable,
              )}
              onClick={onImageClick && !disabled ? onImageClick : undefined}
            />
            {!disabled && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(img.id)
                }}
                className={styles.remove}
              >
                <X className={styles.removeIcon} />
              </button>
            )}
          </div>
          {showLabels && <p className={styles.label}>{img.title}</p>}
        </div>
      ))}
      {images.length < max && onAdd && (
        <div className={styles.item}>
          <button onClick={onAdd} disabled={disabled} className={styles.add}>
            <Plus className={styles.addIcon} />
          </button>
          {showLabels && <p className={styles.addSpacer}>&nbsp;</p>}
        </div>
      )}
      <span className={styles.count}>
        {images.length}/{max}
      </span>
    </div>
  )
}
